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
        startId: null,
        endId: null,
        date: ctx.params.date,
        offset: 0,
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
    const endTime = dayjs.utc(_payload.date).startOf('day').toDate();
    const startTime = dayjs.utc(endTime).subtract(1, 'day').toDate();
    this.logger.info(
      `Get daily statistic events at page ${_payload.offset} for day ${new Date(
        startTime
      )}`
    );

    let startTxId = _payload.startId;
    let endTxId = _payload.endId;
    // If job runs for the 1st time, then needs to query the start and end tx id of the day as the range
    if (!_payload.startId && !_payload.endId) {
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

      startTxId = startTx[0].id;
      endTxId = endTx[0].id;
    }

    const dailyAddresses = await EventAttribute.query()
      .distinct('value')
      .where('tx_id', '>=', startTxId)
      .andWhere('tx_id', '<=', endTxId)
      .andWhere('value', 'like', `${config.networkPrefixAddress}%`)
      .limit(config.dailyStatistics.recordsPerCall)
      .offset(_payload.offset * config.dailyStatistics.recordsPerCall);

    // TODO: Need to re-define if it just count normal addresses only or also the contract addresses
    if (dailyAddresses.length > 0) {
      const activeAddrs = Array.from(
        new Set(
          _payload.addresses.concat(
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
        )
      );
      const offset = _payload.offset + 1;

      await this.createJob(
        BULL_JOB_NAME.CRAWL_DAILY_STATISTICS,
        BULL_JOB_NAME.CRAWL_DAILY_STATISTICS,
        {
          startId: startTxId,
          endId: endTxId,
          date: _payload.date,
          offset,
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
      const [dailyTxs, uniqueAddrs, prevDailyStat] = await Promise.all([
        Transaction.query()
          .count('id')
          .where('timestamp', '>=', startTime)
          .andWhere('timestamp', '<', endTime)
          .andWhere('code', 0),
        Account.query().count('id'),
        DailyStatistics.query().findOne('date', startTime),
      ]);

      const dailyStat = DailyStatistics.fromJson({
        daily_txs: dailyTxs[0].count,
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
  }

  public async _start() {
    dayjs.extend(utc);

    return super._start();
  }
}
