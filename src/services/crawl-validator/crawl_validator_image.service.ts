/* eslint-disable no-param-reassign */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import { Validator } from '../../models';
import config from '../../../config.json' assert { type: 'json' };
import { getImgFromKeybase } from '../../common/utils/validator';

@Service({
  name: SERVICE.V1.CrawlValidatorImgService.key,
  version: 1,
})
export default class CrawlValidatorImageService extends BullableService {
  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_VALIDATOR_IMG,
    jobName: BULL_JOB_NAME.CRAWL_VALIDATOR_IMG,
  })
  public async handleCrawlImg() {
    this.logger.info('crawling validators image.');

    const validatorsDB = await Validator.query();

    if (validatorsDB.length === 0) return;

    const validators = await Promise.all(
      validatorsDB.map(async (validator) => {
        const identity = validator.description?.identity;
        validator.image_url = await getImgFromKeybase(identity);
        return validator;
      })
    );

    await Validator.query()
      .insert(validators)
      .onConflict('operator_address')
      .merge();
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_VALIDATOR_IMG,
      BULL_JOB_NAME.CRAWL_VALIDATOR_IMG,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          pattern: config.crawlValidatorImage.timeCrawlImage,
        },
      }
    );
    return super._start();
  }
}
