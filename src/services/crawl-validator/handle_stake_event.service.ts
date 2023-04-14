import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { parseCoins } from '@cosmjs/proto-signing';
import { BULL_JOB_NAME, ITxIdsParam, SERVICE } from '../../common';
import {
  Account,
  PowerEvent,
  Validator,
  Transaction,
  TransactionEventAttribute,
} from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.HandleStakeEventService.key,
  version: 1,
})
export default class HandleStakeEventService extends BullableService {
  private eventStakes = [
    TransactionEventAttribute.EVENT_KEY.DELEGATE,
    TransactionEventAttribute.EVENT_KEY.REDELEGATE,
    TransactionEventAttribute.EVENT_KEY.UNBOND,
  ];

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.HandleStakeEventService.UpdatePowerEvent.key,
    params: {
      txIds: 'number[]',
    },
  })
  public actionUpdatePowerEvent(ctx: Context<ITxIdsParam>) {
    this.createJob(
      BULL_JOB_NAME.HANDLE_STAKE_EVENT,
      'crawl',
      {
        txIds: ctx.params.txIds,
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
  public async handleJob(_payload: ITxIdsParam): Promise<void> {
    const stakeTxs: any[] = await Transaction.query()
      .joinRelated('events.[attributes]')
      .select(
        'transaction.id',
        'transaction.timestamp',
        'transaction.height',
        'events.id as event_id',
        'events.type',
        'events:attributes.msg_index',
        'events:attributes.key',
        'events:attributes.value'
      )
      .whereIn('transaction.id', _payload.txIds)
      .whereIn('events.type', [
        TransactionEventAttribute.EVENT_KEY.DELEGATE,
        TransactionEventAttribute.EVENT_KEY.REDELEGATE,
        TransactionEventAttribute.EVENT_KEY.UNBOND,
        TransactionEventAttribute.EVENT_KEY.MESSAGE,
      ])
      .andWhere('transaction.code', 0);

    const [validators, accounts]: [Validator[], Account[]] = await Promise.all([
      Validator.query(),
      Account.query().whereIn(
        'address',
        stakeTxs
          .filter((tx) => tx.key === TransactionEventAttribute.EVENT_KEY.SENDER)
          .map((tx) => tx.value)
      ),
    ]);
    const validatorKeys = _.keyBy(validators, 'operator_address');
    const accountKeys = _.keyBy(accounts, 'address');

    const powerEvents: PowerEvent[] = stakeTxs
      .filter((stake) => this.eventStakes.includes(stake.type))
      .filter(
        (stake) =>
          stake.key === TransactionEventAttribute.EVENT_KEY.VALIDATOR ||
          stake.key === TransactionEventAttribute.EVENT_KEY.SOURCE_VALIDATOR
      )
      .map((stake) => {
        this.logger.info(`Handle event stake ${JSON.stringify(stake)}`);
        const stakeEvents = stakeTxs.filter(
          (tx) => tx.event_id === stake.event_id
        );

        let validatorSrcId;
        let validatorDstId;
        switch (stake.type) {
          case PowerEvent.TYPES.DELEGATE:
            validatorDstId = validatorKeys[stake.value].id;
            break;
          case PowerEvent.TYPES.REDELEGATE:
            validatorSrcId = validatorKeys[stake.value].id;
            validatorDstId =
              validatorKeys[
                stakeEvents.find(
                  (event) =>
                    event.key ===
                    TransactionEventAttribute.EVENT_KEY.DESTINATION_VALIDATOR
                ).value
              ].id;
            break;
          case PowerEvent.TYPES.UNBOND:
            validatorSrcId = validatorKeys[stake.value].id;
            break;
          default:
            break;
        }

        const powerEvent: PowerEvent = PowerEvent.fromJson({
          tx_id: stake.id,
          height: stake.height,
          type: stake.type,
          delegator_id:
            accountKeys[
              stakeTxs.find(
                (tx) =>
                  tx.type === TransactionEventAttribute.EVENT_KEY.MESSAGE &&
                  tx.key === TransactionEventAttribute.EVENT_KEY.SENDER &&
                  tx.msg_index === stake.msg_index
              ).value
            ].id,
          validator_src_id: validatorSrcId,
          validator_dst_id: validatorDstId,
          amount: parseCoins(
            stakeEvents.find(
              (event) =>
                event.key === TransactionEventAttribute.EVENT_KEY.AMOUNT
            ).value
          )[0].amount,
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
