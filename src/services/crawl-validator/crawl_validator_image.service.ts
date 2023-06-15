/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-param-reassign */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import axios from 'axios';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, IUpdateImageValidator, SERVICE } from '../../common';
import { Validator } from '../../models';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.CrawlValidatorImgService.key,
  version: 1,
})
export default class CrawlValidatorImageService extends BullableService {
  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_VALIDATOR_IMG,
    jobName: BULL_JOB_NAME.CRAWL_VALIDATOR_IMG,
  })
  public async handleCrawlImg(_payload: {
    validators: IUpdateImageValidator[];
  }): Promise<void> {
    this.logger.info('crawling validators image.');

    // Detect what validators need to be updated.
    let validators: IUpdateImageValidator[] = [];
    const validatorsRetry = _payload?.validators;

    if (validatorsRetry?.length > 0) {
      validators = validatorsRetry;
    } else {
      validators = await Validator.query()
        .where('jailed', false)
        .select('id', 'image_url', 'description')
        .orderBy('id', 'asc');
    }

    if (validators.length === 0) return;

    for (let i = 0; i < validators.length; i++) {
      const validator = validators[i];

      // Get validator image then update.
      try {
        const imageUrl = await this.getImgFromKeybase(
          validator.description?.identity
        );

        await Validator.query()
          .where('id', validator.id)
          .patch({ image_url: imageUrl });
      } catch (error) {
        // Retry error validators.
        if (error) {
          await this.createJobRetry(validators.slice(i));
        }
        throw error;
      }
    }
  }

  async getImgFromKeybase(suffix: string): Promise<string> {
    const defaultValidatorImage = 'validator-default.svg';

    if (!suffix) {
      return defaultValidatorImage;
    }

    const keyBaseUrl = `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${suffix}&fields=pictures`;
    const response = await axios.get(keyBaseUrl);
    const pictureUrl = response.data.them[0]?.pictures?.primary?.url;

    if (pictureUrl) {
      return pictureUrl;
    }

    return defaultValidatorImage;
  }

  public async createJobRetry(
    validators: IUpdateImageValidator[]
  ): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.CRAWL_VALIDATOR_IMG,
      BULL_JOB_NAME.RETRY_CRAWL_VALIDATOR_IMG,
      { validators },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        delay: config.crawlValidatorImage.milliSecondDelayRetry,
      }
    );
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
