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
  EventAttribute,
  Transaction,
} from '../../models';
import {
  BULL_JOB_NAME,
  ICreateSpecificDateJob,
  IStatisticsParam,
  SERVICE,
} from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import Utils from '../../common/utils/utils';

dayjs.extend(utc);

@Service({
  name: SERVICE.V1.DailyStatisticsService.key,
  version: 1,
})
export default class DailyStatisticsService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.DailyStatisticsService.CreateSpecificDateJob.key,
    params: {
      date: 'string',
    },
  })
  public async actionCreateSpecificDateJob(
    ctx: Context<ICreateSpecificDateJob>
  ) {
    await this.createJob(
      BULL_JOB_NAME.CRAWL_DAILY_STATISTICS,
      BULL_JOB_NAME.CRAWL_DAILY_STATISTICS,
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
    queueName: BULL_JOB_NAME.CRAWL_DAILY_STATISTICS,
    jobName: BULL_JOB_NAME.CRAWL_DAILY_STATISTICS,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: IStatisticsParam): Promise<void> {
    const endTime = dayjs.utc(_payload.date).startOf('day').toDate();
    const startTime = dayjs.utc(endTime).subtract(1, 'day').toDate();
    this.logger.info(
      `Get daily statistic events for day ${new Date(startTime)}`
    );

    const startTx = await Transaction.query()
      .select('id')
      .where('transaction.timestamp', '>=', startTime)
      .limit(1)
      .orderBy('id');
    const endTx = await Transaction.query()
      .select('id')
      .where('transaction.timestamp', '<', endTime)
      .limit(1)
      .orderBy('id', 'desc');

    const [dailyTxs, dailyAddresses, uniqueAddrs] = await Promise.all([
      Transaction.query()
        .count('id')
        .where('timestamp', '>=', startTime)
        .andWhere('timestamp', '<', endTime)
        .andWhere('code', 0),
      EventAttribute.query()
        .distinct('value')
        .where('block_height', '>=', startTx[0].height)
        .andWhere('block_height', '<=', endTx[0].height)
        .andWhere('tx_id', '>=', startTx[0].id)
        .andWhere('tx_id', '<=', endTx[0].id)
        .andWhere('value', 'like', `${config.networkPrefixAddress}%`),
      Account.query().count('id'),
    ]);
    // TODO: Need to re-define if it just count normal addresses only or also the contract addresses
    const activeAddrs = Array.from(
      new Set(
        dailyAddresses
          .filter((event) =>
            Utils.isValidAccountAddress(
              event.value,
              config.networkPrefixAddress,
              20
            )
          )
          .map((event) => event.value)
      )
    );

    const dailyStat = DailyStatistics.fromJson({
      daily_txs: dailyTxs[0].count,
      daily_active_addresses: activeAddrs.length,
      unique_addresses: Number(uniqueAddrs[0].count),
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
