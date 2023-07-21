import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import { BlockCheckpoint, Event } from '../../models';

@Service({
  name: SERVICE.V1.CrawlIBCTaoService.key,
  version: 1,
})
export default class CrawlIbcTaoService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_TAO,
    jobName: BULL_JOB_NAME.CRAWL_IBC_TAO,
  })
  public async crawlIbcTao(): Promise<void> {
    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_IBC_TAO,
        [BULL_JOB_NAME.HANDLE_TRANSACTION],
        config.crawlIbcTao.key
      );
    this.logger.info(
      `Handle IBC/TAO, startHeight: ${startHeight}, endHeight: ${endHeight}`
    );
    if (startHeight > endHeight) return;
    const events = await Event.query()
      .withGraphFetched('attributes')
      .joinRelated('[transaction,message]')
      .select('transaction.hash', 'event.id', 'event.type', 'message.content')
      .whereIn('event.type', [Event.EVENT_TYPE.CREATE_CLIENT])
      .andWhere('event.block_height', '>', 2093690)
      .andWhere('event.block_height', '<=', 2282845)
      .orderBy('event.block_height');
    console.log(updateBlockCheckpoint, events);
  }

  async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.CRAWL_IBC_TAO,
      BULL_JOB_NAME.CRAWL_IBC_TAO,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        // repeat: {
        //     every: config.crawlIbcTao.millisecondCrawl,
        // },
      }
    );
    return super._start();
  }
}
