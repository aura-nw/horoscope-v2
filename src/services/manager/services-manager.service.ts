import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import { BlockCheckpoint } from '../../models';

@Service({
  name: SERVICE.V1.ServicesManager.key,
  version: 1,
})
export default class ServicesManagerService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.ServicesManager.HealthCheck.key,
    params: {
      jobNames: {
        type: 'array',
        optional: false,
        items: 'string',
      },
    },
  })
  public async actionHealthCheck(ctx: Context<{ jobNames: string[] }>) {
    const { jobNames } = ctx.params;
    const result: Record<string, boolean> = {};
    const jobBlock = await BlockCheckpoint.query()
      .where('job_name', BULL_JOB_NAME.CRAWL_BLOCK)
      .first()
      .throwIfNotFound();
    const jobsHeight = await BlockCheckpoint.query().whereIn(
      'job_name',
      jobNames
    );
    jobsHeight.forEach((job) => {
      Object.assign(result, {
        [job.job_name]:
          jobBlock.height - job.height <
          config.servicesManager.healthCheckLimit,
      });
    });
    return result;
  }
}
