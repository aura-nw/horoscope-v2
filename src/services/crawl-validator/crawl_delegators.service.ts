/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import {
  BULL_JOB_NAME,
  getLcdClient,
  IAuraJSClientFactory,
  IValidatorDelegators,
  SERVICE,
} from '../../common';
import { BlockCheckpoint, Validator } from '../../models';

@Service({
  name: SERVICE.V1.CrawlDelegatorsService.key,
  version: 1,
})
export default class CrawlDelegatorsService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_DELEGATORS,
    jobName: BULL_JOB_NAME.CRAWL_DELEGATORS,
  })
  public async handleJob(_payload: object): Promise<void> {
    this.logger.info('Update validator delegators');
    const validators: Validator[] = await Validator.query();

    validators.forEach(async (val) => {
      await this.createJob(
        BULL_JOB_NAME.CRAWL_VALIDATOR_DELEGATORS,
        BULL_JOB_NAME.CRAWL_VALIDATOR_DELEGATORS,
        {
          id: val.id,
          address: val.operator_address,
          height: val.delegators_last_height,
        },
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          attempts: config.jobRetryAttempt,
          backoff: config.jobRetryBackoff,
        }
      );
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_VALIDATOR_DELEGATORS,
    jobName: BULL_JOB_NAME.CRAWL_VALIDATOR_DELEGATORS,
  })
  public async handleJobCrawlValidatorDelegators(
    _payload: IValidatorDelegators
  ): Promise<void> {
    this._lcdClient = await getLcdClient();

    const pagination = {
      limit: 1,
      countTotal: true,
    };
    const validatorDelegationInfo =
      await this._lcdClient.cosmos.cosmos.staking.v1beta1.validatorDelegations({
        validatorAddr: _payload.address,
        pagination,
      });

    const totalDelegator = Number(validatorDelegationInfo.pagination.total);
    const latestBlock: BlockCheckpoint | undefined =
      await BlockCheckpoint.query()
        .where('job_name', BULL_JOB_NAME.CRAWL_BLOCK)
        .first();

    await Validator.query()
      .patch({
        delegators_count: totalDelegator,
        delegators_last_height: latestBlock
          ? latestBlock.height
          : _payload.height,
      })
      .where('id', _payload.id);
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_DELEGATORS,
      BULL_JOB_NAME.CRAWL_DELEGATORS,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlDelegators.millisecondCrawl,
        },
      }
    );

    return super._start();
  }
}
