import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { parseCoins } from '@cosmjs/proto-signing';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import {
  PowerEvent,
  Validator,
  EventAttribute,
  Transaction,
  BlockCheckpoint,
  Block,
} from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.HandleStakeEventService.key,
  version: 1,
})
export default class HandleStakeEventService extends BullableService {
  private eventStakes = [
    EventAttribute.EVENT_KEY.DELEGATE,
    EventAttribute.EVENT_KEY.REDELEGATE,
    EventAttribute.EVENT_KEY.UNBOND,
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
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.HANDLE_STAKE_EVENT),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);
    this.logger.info(
      `Block Checkpoint: ${JSON.stringify(stakeEventCheckpoint)}`
    );

    let lastHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (stakeEventCheckpoint) {
      lastHeight = stakeEventCheckpoint.height;
      updateBlockCheckpoint = stakeEventCheckpoint;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_STAKE_EVENT,
        height: 0,
      });

    if (latestBlock) {
      if (latestBlock.height === lastHeight) return;

      const stakeTxs: any[] = [];
      let offset = 0;
      let done = false;
      this.logger.info(
        `Start query Tx from height ${lastHeight} to ${latestBlock.height}`
      );
      while (!done) {
        // eslint-disable-next-line no-await-in-loop
        const resultTx = await Transaction.query()
          .joinRelated('events.[attributes]')
          .select(
            'transaction.id',
            'transaction.timestamp',
            'transaction.height',
            'events.id as event_id',
            'events.type',
            'events:attributes.key',
            'events:attributes.value'
          )
          .whereIn('events.type', [
            EventAttribute.EVENT_KEY.DELEGATE,
            EventAttribute.EVENT_KEY.REDELEGATE,
            EventAttribute.EVENT_KEY.UNBOND,
          ])
          .andWhere('transaction.height', '>', lastHeight)
          .andWhere('transaction.height', '<=', latestBlock.height)
          .andWhere('transaction.code', 0)
          .page(offset, 1000);

        this.logger.info(
          `Query Tx from height ${lastHeight} to ${
            latestBlock.height
          } at page ${offset + 1}`
        );

        if (resultTx.results.length > 0) {
          stakeTxs.push(...resultTx.results);

          offset += 1;
        } else done = true;
      }

      const validators: Validator[] = await Validator.query();
      const validatorKeys = _.keyBy(validators, 'operator_address');

      const powerEvents: PowerEvent[] = stakeTxs
        .filter((stake) => this.eventStakes.includes(stake.type))
        .filter(
          (stake) =>
            stake.key === EventAttribute.EVENT_KEY.VALIDATOR ||
            stake.key === EventAttribute.EVENT_KEY.SOURCE_VALIDATOR
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
                      EventAttribute.EVENT_KEY.DESTINATION_VALIDATOR
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
            validator_src_id: validatorSrcId,
            validator_dst_id: validatorDstId,
            amount: parseCoins(
              stakeEvents.find(
                (event) => event.key === EventAttribute.EVENT_KEY.AMOUNT
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

      updateBlockCheckpoint.height = latestBlock.height;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id');
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
