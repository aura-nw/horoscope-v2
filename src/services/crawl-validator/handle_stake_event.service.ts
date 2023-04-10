import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { BULL_JOB_NAME, ITxMsgIdsParam, SERVICE } from '../../common';
import {
  Account,
  TransactionMessage,
  PowerEvent,
  Validator,
} from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json';

@Service({
  name: SERVICE.V1.HandleStakeEventService.key,
  version: 1,
})
export default class HandleStakeEventService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.HandleStakeEventService.UpdatePowerEvent.key,
    params: {
      txMsgIds: 'number[]',
    },
  })
  public actionUpdatePowerEvent(ctx: Context<ITxMsgIdsParam>) {
    this.createJob(
      BULL_JOB_NAME.HANDLE_STAKE_EVENT,
      'crawl',
      {
        listTxMsgIds: ctx.params.txMsgIds,
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_STAKE_EVENT,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: ITxMsgIdsParam): Promise<void> {
    const stakeTxMsgs: any[] = await TransactionMessage.query()
      .joinRelated('transaction')
      .select(
        'transaction_message.*',
        'transaction.timestamp',
        'transaction.height'
      )
      .whereIn('transaction_message.id', _payload.txMsgIds)
      .andWhere('transaction.code', 0);

    const [validators, accounts]: [Validator[], Account[]] = await Promise.all([
      Validator.query(),
      Account.query().whereIn(
        'address',
        stakeTxMsgs.map((tx) => tx.sender)
      ),
    ]);
    const validatorKeys = _.keyBy(validators, 'operator_address');
    const accountKeys = _.keyBy(accounts, 'address');

    const powerEvents: PowerEvent[] = stakeTxMsgs.map((stake) => {
      this.logger.info(`Handle message stake ${JSON.stringify(stake)}`);

      let validatorSrcId;
      let validatorDstId;
      switch (stake.type) {
        case PowerEvent.TYPES.DELEGATE:
          validatorDstId = validatorKeys[stake.content.validator_address].id;
          break;
        case PowerEvent.TYPES.REDELEGATE:
          validatorSrcId =
            validatorKeys[stake.content.validator_src_address].id;
          validatorDstId =
            validatorKeys[stake.content.validator_dst_address].id;
          break;
        case PowerEvent.TYPES.UNBOND:
          validatorSrcId = validatorKeys[stake.content.validator_address].id;
          break;
        default:
          break;
      }

      const powerEvent: PowerEvent = PowerEvent.fromJson({
        tx_id: stake.tx_id,
        height: stake.height,
        type: stake.type,
        delegator_id: accountKeys[stake.sender].id,
        validator_src_id: validatorSrcId,
        validator_dst_id: validatorDstId,
        amount: stake.content.amount.amount,
        time: stake.timestamp.toISOString(),
      });

      return powerEvent;
    });

    await PowerEvent.query()
      .insert(powerEvents)
      .catch((error) => {
        this.logger.error("Error insert validator's power events");
        this.logger.error(error);
      });
  }
}
