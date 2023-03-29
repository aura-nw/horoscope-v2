import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { Validator } from '../../models/validator';
import TransactionEventAttribute from '../../models/transaction_event_attribute';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_ACTION_NAME,
  BULL_JOB_NAME,
  MSG_TYPE,
  SERVICE_NAME,
} from '../../common/constant';
import TransactionPowerEvent from '../../models/transaction_power_event';
import config from '../../../config.json';
import { IListTxStakesParam } from '../../common/utils/request';

@Service({
  name: SERVICE_NAME.HANDLE_STAKE_EVENT,
  version: 1,
})
export default class HandleStakeEventService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: BULL_ACTION_NAME.UPDATE_STAKE_EVENT,
    params: {
      listTxStakes: 'any[]',
    },
  })
  public actionUpdatePowerEvent(ctx: Context<IListTxStakesParam>) {
    this.createJob(
      BULL_JOB_NAME.HANDLE_STAKE_EVENT,
      'crawl',
      {
        listTxStakes: ctx.params.listTxStakes,
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
  private async handleJob(_payload: IListTxStakesParam): Promise<void> {
    const listTxStakes: any[] = [];
    _payload.listTxStakes.forEach((tx) => {
      if (
        !listTxStakes.find(
          (txStk) =>
            txStk.tx_msg_id === tx.tx_msg_id && txStk.index === tx.index
        )
      )
        listTxStakes.push(tx);
    });

    const validators: Validator[] = await Validator.query();

    const listInsert: TransactionPowerEvent[] = listTxStakes.map((stake) => {
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
        case TransactionEventAttribute.EVENT_KEY.UNBOND:
          validatorSrcId = validators.find(
            (val) => val.operator_address === stake.content.validator_address
          )?.id;
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
          amount: stake.content.amount.amount,
          time: stake.timestamp,
        });

      return txPowerEvent;
    });

    try {
      await TransactionPowerEvent.query().insert(listInsert);
    } catch (error) {
      this.logger.error(error);
    }
  }
}
