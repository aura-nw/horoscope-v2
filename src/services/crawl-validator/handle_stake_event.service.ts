import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import {
  BULL_JOB_NAME,
  IListTxMsgIdsParam,
  MSG_TYPE,
  SERVICE,
} from '../../common';
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
      listTxMsgIds: 'number[]',
    },
  })
  public actionUpdatePowerEvent(ctx: Context<IListTxMsgIdsParam>) {
    this.createJob(
      BULL_JOB_NAME.HANDLE_STAKE_EVENT,
      'crawl',
      {
        listTxMsgIds: ctx.params.listTxMsgIds,
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
  public async handleJob(_payload: IListTxMsgIdsParam): Promise<void> {
    const listTxStakes: any[] = await TransactionMessage.query()
      .joinRelated('transaction')
      .select('transaction_message.*', 'transaction.timestamp')
      .whereIn('transaction_message.id', _payload.listTxMsgIds)
      .andWhere('transaction.code', 0);

    const [validators, accounts]: [Validator[], Account[]] = await Promise.all([
      Validator.query(),
      Account.query().whereIn(
        'address',
        listTxStakes.map((tx) => tx.sender)
      ),
    ]);

    const listInsert: PowerEvent[] = listTxStakes.map((stake) => {
      this.logger.info(`Handle message stake ${JSON.stringify(stake)}`);

      let validatorSrcId;
      let validatorDstId;
      switch (stake.type) {
        case MSG_TYPE.MSG_DELEGATE:
          validatorSrcId = validators.find(
            (val) => val.operator_address === stake.content.validator_address
          )?.id;
          break;
        case MSG_TYPE.MSG_REDELEGATE:
          validatorSrcId = validators.find(
            (val) =>
              val.operator_address === stake.content.validator_src_address
          )?.id;
          validatorDstId = validators.find(
            (val) =>
              val.operator_address === stake.content.validator_dst_address
          )?.id;
          break;
        case MSG_TYPE.MSG_UNDELEGATE:
          validatorSrcId = validators.find(
            (val) => val.operator_address === stake.content.validator_address
          )?.id;
          break;
        default:
          break;
      }

      const txPowerEvent: PowerEvent = PowerEvent.fromJson({
        tx_id: stake.tx_id,
        type: stake.type,
        delegator_id: accounts.find((acc) => acc.address === stake.sender)?.id,
        validator_src_id: validatorSrcId,
        validator_dst_id: validatorDstId,
        amount: stake.content.amount.amount,
        time: stake.timestamp.toISOString(),
      });

      return txPowerEvent;
    });

    await PowerEvent.query()
      .insert(listInsert)
      .catch((error) => {
        this.logger.error("Error insert validator's power events");
        this.logger.error(error);
      });
  }
}
