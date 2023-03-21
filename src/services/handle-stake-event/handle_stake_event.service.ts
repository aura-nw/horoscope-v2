import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import Utils from '../../common/utils/utils';
import { Config } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_ACTION_NAME,
  BULL_JOB_NAME,
  CONST_CHAR,
  SERVICE_NAME,
} from '../../common/constant';
import BlockCheckpoint from '../../models/block_checkpoint';
import Block from '../../models/block';
import Transaction from '../../models/transaction';
import TransactionPowerEvent from '../../models/transaction_power_event';

@Service({
  name: SERVICE_NAME.HANDLE_STAKE_EVENT,
  version: CONST_CHAR.VERSION_NUMBER,
})
export default class HandleStakeEventService extends BullableService {
  private _lcdClient: any;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_STAKE_EVENT,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  private async handleJob(_payload: object): Promise<void> {
    const [handleStakeEventBlockCheckpoint, latestBlock]: [
      BlockCheckpoint | undefined,
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('height')
        .findOne('job_name', BULL_JOB_NAME.HANDLE_ADDRESS),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);

    let lastHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (handleStakeEventBlockCheckpoint) {
      lastHeight = handleStakeEventBlockCheckpoint.height;
      updateBlockCheckpoint = handleStakeEventBlockCheckpoint;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.CRAWL_VALIDATOR,
        height: 0,
      });

    if (latestBlock) {
      const listTxs: any[] = [];
      let offset = 0;
      let done = false;
      while (!done) {
        // eslint-disable-next-line no-await-in-loop
        const resultTx = await Transaction.query()
          .select(
            'transaction.id',
            'transaction.height',
            'transaction.hash',
            'transaction.timestamp'
          )
          .join(
            'transaction_message',
            'transaction.id',
            'transaction_message.tx_id'
          )
          .select('transaction_message.sender')
          .join(
            'transaction_event',
            'transaction.id',
            'transaction_event.tx_id'
          )
          .select(
            'transaction_event.id as tx_event_id',
            'transaction_event.tx_id',
            'transaction_event.type'
          )
          .join(
            'transaction_event_attribute',
            'transaction_event.id',
            'transaction_event_attribute.event_id'
          )
          .select(
            'transaction_event_attribute.key',
            'transaction_event_attribute.value'
          )
          .join('account', 'transaction_message.sender', 'account.address')
          .select('account.id as delegator_id')
          .where('transaction.height', '>', lastHeight)
          .andWhere('transaction.height', '<=', latestBlock.height)
          .andWhere((builder) =>
            builder.whereIn('transaction_event_attribute.key', [
              CONST_CHAR.RECEIVER,
              CONST_CHAR.SPENDER,
              CONST_CHAR.SENDER,
              CONST_CHAR.STAKING,
              CONST_CHAR.VALIDATOR,
              CONST_CHAR.SOURCE_VALIDATOR,
              CONST_CHAR.DESTINATION_VALIDATOR,
              CONST_CHAR.AMOUNT,
            ])
          )
          .andWhere((builder) =>
            builder.whereIn('transaction_event.type', [
              CONST_CHAR.RECEIVER,
              CONST_CHAR.SPENDER,
              CONST_CHAR.SENDER,
              CONST_CHAR.DELEGATE,
              CONST_CHAR.REDELEGATE,
              CONST_CHAR.UNBOND,
            ])
          )
          .limit(100)
          .offset(offset);
        this.logger.info(
          `Result get Tx from height ${lastHeight} to ${
            latestBlock.height
          }: ${JSON.stringify(resultTx)}`
        );

        if (resultTx.length > 0) listTxs.push(...resultTx);

        if (resultTx.length === 100) offset += 1;
        else done = true;
      }

      const stakeType: any[] = listTxs.filter(
        (tx) =>
          (tx.type === CONST_CHAR.DELEGATE ||
            tx.type === CONST_CHAR.REDELEGATE ||
            tx.type === CONST_CHAR.UNBOND) &&
          tx.key === CONST_CHAR.AMOUNT
      );

      const listInsert: TransactionPowerEvent[] = stakeType.map((stake) => {
        let validatorSrcId;
        let validatorDstId;
        switch (stake.type) {
          case CONST_CHAR.DELEGATE:
            validatorSrcId = listTxs.find(
              (tx) => tx.id === stake.id && tx.key === CONST_CHAR.VALIDATOR
            ).value;
            break;
          case CONST_CHAR.REDELEGATE:
            validatorSrcId = listTxs.find(
              (tx) =>
                tx.id === stake.id && tx.key === CONST_CHAR.SOURCE_VALIDATOR
            ).value;
            validatorDstId = listTxs.find(
              (tx) =>
                tx.id === stake.id &&
                tx.key === CONST_CHAR.DESTINATION_VALIDATOR
            ).value;
            break;
          case CONST_CHAR.UNBOND:
            validatorSrcId = listTxs.find(
              (tx) => tx.id === stake.id && tx.key === CONST_CHAR.VALIDATOR
            ).value;
            break;
          default:
            break;
        }

        const txPowerEvent: TransactionPowerEvent =
          TransactionPowerEvent.fromJson({
            tx_id: stake.tx_id,
            type: stake.type,
            delegator_id: stake.delegator_id,
            validator_src_id: validatorSrcId,
            validator_dst_id: validatorDstId,
            amount: listTxs.find(
              (tx) => tx.id === stake.id && tx.key === CONST_CHAR.AMOUNT
            ).value,
            time: stake.timestamp,
          });

        return txPowerEvent;
      });

      try {
        await TransactionPowerEvent.query().insert(listInsert);
      } catch (error) {
        this.logger.error(error);
      }

      const listAddresses: string[] = listTxs
        .filter(
          (tx) =>
            tx.key === CONST_CHAR.RECEIVER ||
            tx.key === CONST_CHAR.SPENDER ||
            tx.key === CONST_CHAR.SENDER
        )
        .map((tx) => tx.value)
        .filter(Utils._onlyUnique)
        .filter((addr: string) =>
          Utils.isValidAccountAddress(addr, Config.NETWORK_PREFIX_ADDRESS, 20)
        );
      this.broker.call(
        `${CONST_CHAR.VERSION}.${SERVICE_NAME.CRAWL_ACCOUNT_STAKE}.${BULL_ACTION_NAME.ACCOUNT_STAKE_UPSERT}`,
        { listAddresses }
      );

      updateBlockCheckpoint.height = latestBlock.height;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id');
    }
  }
}
