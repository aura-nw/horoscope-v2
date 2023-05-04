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
  Transaction,
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
  ];

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_STAKE_EVENT,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const [stakeEventCheckpoint, latestBlock]: [
      BlockCheckpoint | undefined,
      EventAttribute | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.HANDLE_STAKE_EVENT),
      EventAttribute.query()
        .select('block_height')
        .findOne({})
        .orderBy('block_height', 'desc'),
    ]);
    this.logger.info(
      `Block Checkpoint: ${JSON.stringify(stakeEventCheckpoint)}`
    );

    let startHeight = 0;
    let endHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (stakeEventCheckpoint) {
      startHeight = stakeEventCheckpoint.height;
      updateBlockCheckpoint = stakeEventCheckpoint;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_STAKE_EVENT,
        height: 0,
      });

    if (latestBlock) {
      if (latestBlock.block_height === startHeight) return;
      endHeight = Math.min(
        startHeight + config.handleStakeEvent.blocksPerCall,
        latestBlock.block_height
      );

      const stakeTxs: any[] = [];
      this.logger.info(`Query Tx from height ${startHeight} to ${endHeight}`);
      const resultTx = await Transaction.query()
        .joinRelated('events.[attributes]')
        .select(
          'transaction.id',
          'transaction.timestamp',
          'transaction.height',
          'events.id as event_id',
          'events.type',
          'events:attributes.key',
          'events:attributes.value',
          'events:attributes.index'
        )
        .whereIn('events.type', this.eventStakes)
        .andWhere('transaction.height', '>', startHeight)
        .andWhere('transaction.height', '<=', endHeight)
        .andWhere('transaction.code', 0);

      if (resultTx.length > 0) stakeTxs.push(...resultTx);

      const validators: Validator[] = await Validator.query();
      const validatorKeys = _.keyBy(validators, 'operator_address');

      const powerEvents: PowerEvent[] = stakeTxs
        .filter(
          (event) =>
            this.eventStakes.includes(event.type) &&
            (event.key === EventAttribute.ATTRIBUTE_KEY.VALIDATOR ||
              event.key === EventAttribute.ATTRIBUTE_KEY.SOURCE_VALIDATOR)
        )
        .map((stakeEvent) => {
          this.logger.info(`Handle event stake ${JSON.stringify(stakeEvent)}`);
          const stakeEvents = stakeTxs.filter(
            (tx) => tx.event_id === stakeEvent.event_id
          );

          let validatorSrcId;
          let validatorDstId;
          let amount;
          switch (stakeEvent.type) {
            case PowerEvent.TYPES.DELEGATE:
              validatorDstId = validatorKeys[stakeEvent.value].id;
              break;
            case PowerEvent.TYPES.REDELEGATE:
              validatorSrcId = validatorKeys[stakeEvent.value].id;
              validatorDstId =
                validatorKeys[
                  stakeEvents.find(
                    (event) =>
                      event.key ===
                        EventAttribute.ATTRIBUTE_KEY.DESTINATION_VALIDATOR &&
                      event.index === stakeEvent.index + 1
                  ).value
                ].id;
              amount = parseCoins(
                stakeEvents.find(
                  (event) =>
                    event.key === EventAttribute.ATTRIBUTE_KEY.AMOUNT &&
                    event.index === stakeEvent.index + 2
                ).value
              )[0].amount;
              break;
            case PowerEvent.TYPES.UNBOND:
              validatorSrcId = validatorKeys[stakeEvent.value].id;
              break;
            default:
              break;
          }

          const powerEvent: PowerEvent = PowerEvent.fromJson({
            tx_id: stakeEvent.id,
            height: stakeEvent.height,
            type: stakeEvent.type,
            validator_src_id: validatorSrcId,
            validator_dst_id: validatorDstId,
            amount:
              amount ??
              parseCoins(
                stakeEvents.find(
                  (event) =>
                    event.key === EventAttribute.ATTRIBUTE_KEY.AMOUNT &&
                    event.index === stakeEvent.index + 1
                ).value
              )[0].amount,
            time: stakeEvent.timestamp.toISOString(),
          });

          return powerEvent;
        });

      await knex.transaction(async (trx) => {
        if (powerEvents.length > 0)
          await PowerEvent.query()
            .insert(powerEvents)
            .transacting(trx)
            .catch((error) => {
              this.logger.error("Error insert validator's power events");
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
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.HANDLE_STAKE_EVENT,
      'crawl',
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
