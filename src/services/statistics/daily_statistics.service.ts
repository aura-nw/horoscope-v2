import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Account, DailyStatistics, Transaction } from '../../models';
import {
  BULL_JOB_NAME,
  ICreateSpecificDateJob,
  IDailyStatsParam,
  SERVICE,
} from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import Utils from '../../common/utils/utils';

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
        offset: 0,
        txIds: [],
        addresses: [],
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_DAILY_STATISTICS,
    jobName: BULL_JOB_NAME.CRAWL_DAILY_STATISTICS,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: IDailyStatsParam): Promise<void> {
    try {
      const startTime = dayjs
        .utc(_payload.date)
        .subtract(1, 'day')
        .startOf('day')
        .toDate();
      const endTime = dayjs.utc(_payload.date).startOf('day').toDate();
      this.logger.info(
        `Get daily statistic events at page ${
          _payload.offset
        } for day ${new Date(startTime)}`
      );

      const dailyEvents = await Transaction.query()
        .joinRelated('events.[attributes]')
        .select('transaction.id', 'transaction.code', 'events:attributes.value')
        .where('transaction.timestamp', '>=', startTime)
        .andWhere('transaction.timestamp', '<', endTime)
        .andWhere(
          'events:attributes.value',
          'like',
          `${config.networkPrefixAddress}%`
        )
        .orderBy('transaction.id')
        .limit(config.dailyStatistics.recordsPerCall)
        .offset(_payload.offset * config.dailyStatistics.recordsPerCall);

      if (dailyEvents.length > 0) {
        const activeAddrs = Array.from(
          new Set(
            _payload.addresses.concat(
              dailyEvents
                .filter((event) =>
                  Utils.isValidAccountAddress(
                    event.value,
                    config.networkPrefixAddress,
                    20
                  )
                )
                .map((event) => event.value)
            )
          )
        );
        const dailyTxs = Array.from(
          new Set(
            _payload.txIds.concat(
              Array.from(
                new Set(
                  dailyEvents
                    .filter((event) => event.code === 0)
                    .map((event) => event.id)
                )
              )
            )
          )
        );
        const offset = _payload.offset + 1;

        await this.createJob(
          BULL_JOB_NAME.CRAWL_DAILY_STATISTICS,
          BULL_JOB_NAME.CRAWL_DAILY_STATISTICS,
          {
            date: _payload.date,
            offset,
            txIds: dailyTxs,
            addresses: activeAddrs,
          },
          {
            removeOnComplete: true,
            removeOnFail: {
              count: 3,
            },
          }
        );
      } else {
        const [uniqueAddrs, prevDailyStat] = await Promise.all([
          Account.query().count('id'),
          DailyStatistics.query().findOne('date', startTime),
        ]);

        const dailyStat = DailyStatistics.fromJson({
          daily_txs: _payload.txIds.length,
          daily_active_addresses: _payload.addresses.length,
          unique_addresses: Number(uniqueAddrs[0].count),
          unique_addresses_increase: prevDailyStat
            ? uniqueAddrs[0].count - prevDailyStat.unique_addresses
            : 0,
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
    } catch (error) {
      this.logger.error(error);
    }
  }

  public async _start() {
    dayjs.extend(utc);

    return super._start();
  }
}
