import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import { BlockCheckpoint } from '../../models';

@Service({
  name: SERVICE.V1.CrawlIBCAppService.key,
  version: 1,
})
export default class CrawlIbcAppService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_APP,
    jobName: BULL_JOB_NAME.CRAWL_IBC_APP,
  })
  public async crawlIbcApp(): Promise<void> {
    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_IBC_APP,
        [BULL_JOB_NAME.CRAWL_IBC_TAO],
        config.crawlIbcTao.key
      );
    this.logger.info(
      `Handle IBC/APP, startHeight: ${startHeight}, endHeight: ${endHeight}`
    );
    if (startHeight > endHeight) return;
    this.logger.info(updateBlockCheckpoint);
  }
}
