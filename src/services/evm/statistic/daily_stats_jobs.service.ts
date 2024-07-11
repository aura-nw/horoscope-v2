import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME, SERVICE } from '../constant';
import config from '../../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../../base/bullable.service';

@Service({
  name: SERVICE.V1.DailyEVMStatsJobsService.key,
  version: 1,
})
export default class DailyEVMStatsJobsService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_DAILY_EVM_STATS_JOBS,
    jobName: BULL_JOB_NAME.HANDLE_DAILY_EVM_STATS_JOBS,
  })
  public async handleJob(_payload: object): Promise<void> {
    const date = new Date().toString();

    await Promise.all([
      this.broker.call(
        SERVICE.V1.DailyEVMStatisticsService.CreateSpecificDateJob.path,
        { date }
      ),
      this.broker.call(
        SERVICE.V1.EVMAccountStatisticsService.CreateSpecificDateJob.path,
        { date }
      ),
    ]);
  }

  public async _start() {
    await this.broker.waitForServices([
      SERVICE.V1.DailyEVMStatisticsService.path,
      SERVICE.V1.EVMAccountStatisticsService.path,
    ]);

    this.createJob(
      BULL_JOB_NAME.HANDLE_DAILY_EVM_STATS_JOBS,
      BULL_JOB_NAME.HANDLE_DAILY_EVM_STATS_JOBS,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          pattern: config.dailyEVMStatsJobs.jobPattern,
        },
      }
    );

    return super._start();
  }
}
