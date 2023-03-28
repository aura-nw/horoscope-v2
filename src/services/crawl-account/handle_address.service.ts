import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import Utils from '../../common/utils/utils';
import { BULL_JOB_NAME, SERVICE_NAME, SERVICE } from '../../common/constant';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';
import BlockCheckpoint from '../../models/block_checkpoint';
import Block from '../../models/block';
import Transaction from '../../models/transaction';
import { Account } from '../../models/account';
import config from '../../../config.json';
import TransactionEventAttribute from '../../models/transaction_event_attribute';

@Service({
  name: SERVICE_NAME.HANDLE_ADDRESS,
  version: 1,
})
export default class HandleAddressService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ADDRESS,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const listInsert: any[] = [];

    const [handleAddressBlockCheckpoint, latestBlock]: [
      BlockCheckpoint | undefined,
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.HANDLE_ADDRESS),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);
    this.logger.info(
      `Block Checkpoint: ${JSON.stringify(handleAddressBlockCheckpoint)}`
    );

    let lastHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (handleAddressBlockCheckpoint) {
      lastHeight = handleAddressBlockCheckpoint.height;
      updateBlockCheckpoint = handleAddressBlockCheckpoint;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_ADDRESS,
        height: 0,
      });

    if (latestBlock) {
      if (latestBlock.height === lastHeight) return;

      const eventAddresses: string[] = [];
      let offset = 0;
      let done = false;
      while (!done) {
        // eslint-disable-next-line no-await-in-loop
        const resultTx = await Transaction.query()
          .select('transaction.id', 'transaction.height')
          .join(
            'transaction_event',
            'transaction.id',
            'transaction_event.tx_id'
          )
          .select('transaction_event.tx_id')
          .join(
            'transaction_event_attribute',
            'transaction_event.id',
            'transaction_event_attribute.event_id'
          )
          .select(
            'transaction_event_attribute.key',
            'transaction_event_attribute.value'
          )
          .where('transaction.height', '>', lastHeight)
          .andWhere('transaction.height', '<=', latestBlock.height)
          .andWhere((builder) =>
            builder.whereIn('transaction_event_attribute.key', [
              TransactionEventAttribute.EVENT_KEY.RECEIVER,
              TransactionEventAttribute.EVENT_KEY.SPENDER,
              TransactionEventAttribute.EVENT_KEY.SENDER,
            ])
          )
          .limit(100)
          .offset(offset);
        this.logger.info(
          `Result get Tx from height ${lastHeight} to ${latestBlock.height}:`
        );
        this.logger.info(JSON.stringify(resultTx));

        if (resultTx.length > 0)
          resultTx.map((res: any) => eventAddresses.push(res.value));

        if (resultTx.length === 100) offset += 1;
        else done = true;
      }

      const listAddresses = eventAddresses
        .filter((addr: string) => Utils.isValidAddress(addr, 20))
        .filter(Utils._onlyUnique);

      if (listAddresses.length > 0) {
        const existedAccounts: string[] = (
          await Account.query().select('*').whereIn('address', listAddresses)
        ).map((account: Account) => account.address);

        listAddresses.forEach((address: string) => {
          if (!existedAccounts.includes(address)) {
            const account: Account = Account.fromJson({
              address,
              balances: [],
              spendable_balances: [],
              type: null,
              pubkey: {},
              account_number: 0,
              sequence: 0,
            });
            listInsert.push(Account.query().insert(account));
          }
        });

        try {
          updateBlockCheckpoint.height = latestBlock.height;
          await Promise.all([
            ...listInsert,
            BlockCheckpoint.query()
              .insert(updateBlockCheckpoint)
              .onConflict('job_name')
              .merge()
              .returning('id'),
          ]);
        } catch (error) {
          this.logger.error(error);
        }

        this.broker.call(`${SERVICE.V1.CrawlAccount.UpdateAccount}`, {
          listAddresses,
        });
      }
    }
  }

  public async _start() {
    await this.broker.waitForServices([`${SERVICE.V1.CrawlAccount.name}`]);

    this.createJob(
      BULL_JOB_NAME.HANDLE_ADDRESS,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.milisecondCrawlJob.handleAddress,
        },
      }
    );

    return super._start();
  }
}
