import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { parseCoins } from '@cosmjs/proto-signing';
import knex from '../../common/utils/db_connection';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import {
  PowerEvent,
  Validator,
  Event,
  EventAttribute,
  BlockCheckpoint,
} from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.HandleStakeEventService.key,
  version: 1,
})
export default class HandleStakeEventService extends BullableService {
  private eventStakes = [
    Event.EVENT_TYPE.DELEGATE,
    Event.EVENT_TYPE.REDELEGATE,
    Event.EVENT_TYPE.UNBOND,
    Event.EVENT_TYPE.CREATE_VALIDATOR,
  ];

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_STAKE_EVENT,
    jobName: BULL_JOB_NAME.HANDLE_STAKE_EVENT,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_STAKE_EVENT,
        [BULL_JOB_NAME.HANDLE_TRANSACTION, BULL_JOB_NAME.CRAWL_VALIDATOR],
        config.handleStakeEvent.key
      );
    this.logger.info(`startHeight: ${startHeight}, endHeight: ${endHeight}`);
    if (startHeight >= endHeight) return;

    const stakeEvents: any[] = [];
    const resultEvents = await Event.query()
      .select('event.id as event_id', 'event.type', 'event.block_height')
      .withGraphFetched('transaction')
      .modifyGraph('transaction', (builder) => {
        builder.select('id', 'timestamp');
      })
      .withGraphFetched('attributes')
      .modifyGraph('attributes', (builder) => {
        builder.select('key', 'value', 'index').orderBy('index');
      })
      .whereIn('event.type', this.eventStakes)
      .andWhere('event.block_height', '>', startHeight)
      .andWhere('event.block_height', '<=', endHeight);

    if (resultEvents.length > 0) stakeEvents.push(...resultEvents);

    const validators: Validator[] = await Validator.query();
    const validatorKeys = _.keyBy(validators, 'operator_address');

    const powerEvents: PowerEvent[] = [];
    stakeEvents
      .filter(
        (event) =>
          this.eventStakes.includes(event.type) &&
          (event.attributes
            .map((a: any) => a.key)
            .includes(EventAttribute.ATTRIBUTE_KEY.VALIDATOR) ||
            event.attributes
              .map((a: any) => a.key)
              .includes(EventAttribute.ATTRIBUTE_KEY.SOURCE_VALIDATOR))
      )
      .forEach((stakeEvent) => {
        try {
          let validatorSrcId;
          let validatorDstId;
          let amount;
          const firstValidator = stakeEvent.attributes.find(
            (attr: any) =>
              attr.key === EventAttribute.ATTRIBUTE_KEY.VALIDATOR ||
              attr.key === EventAttribute.ATTRIBUTE_KEY.SOURCE_VALIDATOR
          );
          const destValidator = stakeEvent.attributes.find(
            (attr: any) =>
              attr.key === EventAttribute.ATTRIBUTE_KEY.DESTINATION_VALIDATOR
          );
          switch (stakeEvent.type) {
            case PowerEvent.TYPES.DELEGATE: {
              validatorDstId = validatorKeys[firstValidator.value].id;
              break;
            }
            case PowerEvent.TYPES.REDELEGATE:
              validatorSrcId = validatorKeys[firstValidator.value].id;
              validatorDstId = validatorKeys[destValidator.value].id;
              amount = parseCoins(
                stakeEvent.attributes.find(
                  (attr: any) =>
                    attr.key === EventAttribute.ATTRIBUTE_KEY.AMOUNT &&
                    attr.index === firstValidator.index + 2
                ).value
              )[0].amount;
              break;
            case PowerEvent.TYPES.UNBOND:
              validatorSrcId = validatorKeys[firstValidator.value].id;
              break;
            case PowerEvent.TYPES.CREATE_VALIDATOR:
              validatorDstId = validatorKeys[firstValidator.value].id;
              amount = parseCoins(
                stakeEvent.attributes.find(
                  (attr: any) =>
                    attr.key === EventAttribute.ATTRIBUTE_KEY.AMOUNT &&
                    attr.index === firstValidator.index + 1
                ).value
              )[0].amount;
              break;
            default:
              break;
          }

          const powerEvent: PowerEvent = PowerEvent.fromJson({
            tx_id: stakeEvent.transaction.id,
            height: stakeEvent.block_height,
            type: stakeEvent.type,
            validator_src_id: validatorSrcId,
            validator_dst_id: validatorDstId,
            amount:
              amount ??
              parseCoins(
                stakeEvent.attributes.find(
                  (attr: any) =>
                    attr.key === EventAttribute.ATTRIBUTE_KEY.AMOUNT &&
                    attr.index === firstValidator.index + 1
                ).value
              )[0].amount,
            time: stakeEvent.transaction.timestamp.toISOString(),
          });

          powerEvents.push(powerEvent);
        } catch (error) {
          this.logger.error(
            `Error create power event: ${JSON.stringify(stakeEvent)}`
          );
          this.logger.error(error);
        }
      });

    await knex.transaction(async (trx) => {
      if (powerEvents.length > 0)
        await PowerEvent.query()
          .insert(powerEvents)
          .transacting(trx)
          .catch((error) => {
            this.logger.error(
              `Error insert validator's power events: ${JSON.stringify(
                powerEvents
              )}`
            );
            this.logger.error(error);
          });

      updateBlockCheckpoint.height = endHeight;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id')
        .transacting(trx);
    });
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.HANDLE_STAKE_EVENT,
      BULL_JOB_NAME.HANDLE_STAKE_EVENT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.handleStakeEvent.millisecondCrawl,
        },
      }
    );

    return super._start();
  }
}
