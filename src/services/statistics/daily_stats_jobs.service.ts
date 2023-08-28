import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';

@Service({
  name: SERVICE.V1.DailyStatsJobsService.key,
  version: 1,
})
export default class DailyStatsJobsService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_DAILY_STATS_JOBS,
    jobName: BULL_JOB_NAME.HANDLE_DAILY_STATS_JOBS,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const date = new Date().toString();

    await Promise.all([
      this.broker.call(
        SERVICE.V1.DailyStatisticsService.CreateSpecificDateJob.path,
        { date }
      ),
      this.broker.call(
        SERVICE.V1.AccountStatisticsService.CreateSpecificDateJob.path,
        { date }
      ),
    ]);
  }

  public async _start() {
    await this.broker.waitForServices([
      SERVICE.V1.DailyStatisticsService.name,
      SERVICE.V1.AccountStatisticsService.name,
    ]);

    this.createJob(
      BULL_JOB_NAME.HANDLE_DAILY_STATS_JOBS,
      BULL_JOB_NAME.HANDLE_DAILY_STATS_JOBS,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          pattern: config.dailyStatsJobs.jobPattern,
        },
      }
    );

    return super._start();
  }
}
