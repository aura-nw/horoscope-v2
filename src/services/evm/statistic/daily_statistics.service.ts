import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  Account,
  DailyStatistics,
  EVMBlock,
  EVMTransaction,
} from '../../../models';
import { BULL_JOB_NAME, SERVICE } from '../constant';
import config from '../../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../../base/bullable.service';

dayjs.extend(utc);

@Service({
  name: SERVICE.V1.DailyEVMStatisticsService.key,
  version: 1,
})
export default class DailyEVMStatisticsService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.DailyEVMStatisticsService.CreateSpecificDateJob.key,
    params: {
      date: 'string',
    },
  })
  public async actionCreateSpecificDateJob(ctx: Context<{ date: string }>) {
    await this.createJob(
      BULL_JOB_NAME.CRAWL_DAILY_EVM_STATISTICS,
      BULL_JOB_NAME.CRAWL_DAILY_EVM_STATISTICS,
      {
        date: ctx.params.date,
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
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_DAILY_EVM_STATISTICS,
    jobName: BULL_JOB_NAME.CRAWL_DAILY_EVM_STATISTICS,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: { date: string }): Promise<void> {
    const endTime = dayjs.utc(_payload.date).startOf('day').toDate();
    const startTime = dayjs.utc(endTime).subtract(1, 'day').toDate();
    this.logger.info(
      `Get daily statistic events for day ${new Date(startTime)}`
    );

    const [startBlock, endBlock] = await Promise.all([
      EVMBlock.query()
        .select('height')
        .where('timestamp', '>=', startTime)
        .limit(1)
        .orderBy('height'),
      EVMBlock.query()
        .select('height')
        .where('timestamp', '<', endTime)
        .limit(1)
        .orderBy('height', 'desc'),
    ]);

    const [dailyTxs, totalAddresses] = await Promise.all([
      EVMTransaction.query()
        .where('height', '>=', startBlock[0].height)
        .andWhere('height', '<=', endBlock[0].height),
      Account.query().count('id'),
    ]);

    const activeAddrs = Array.from(new Set(dailyTxs.map((tx) => tx.from)));

    const dailyStat = DailyStatistics.fromJson({
      daily_txs: dailyTxs.length,
      daily_active_addresses: activeAddrs.length,
      unique_addresses: Number(totalAddresses[0].count),
      date: startTime.toISOString(),
    });

    this.logger.info(`Insert new daily statistic for date ${startTime}`);
    await DailyStatistics.query()
      .insert(dailyStat)
      .catch((error) => {
        this.logger.error('Error insert new daily statistic record');
        this.logger.error(error);
      });
  }
}
