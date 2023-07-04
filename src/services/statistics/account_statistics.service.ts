/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { parseCoins } from '@cosmjs/proto-signing';
import {
  AccountStatistics,
  Event,
  EventAttribute,
  Transaction,
} from '../../models';
import {
  BULL_JOB_NAME,
  IAccountStatsParam,
  REDIS_KEY,
  SERVICE,
} from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';

@Service({
  name: SERVICE.V1.AccountStatisticsService.key,
  version: 1,
})
export default class AccountStatisticsService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
    jobName: BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: IAccountStatsParam): Promise<void> {
    try {
      const { accountStats } = _payload;

      const syncDate = new Date();
      const endTime = syncDate.setUTCHours(0, 0, 0, 0);
      syncDate.setDate(syncDate.getDate() - 1);
      const startTime = syncDate.setUTCHours(0, 0, 0, 0);
      this.logger.info(
        `Get account statistic events at page ${
          _payload.offset
        } for day ${new Date(startTime)}`
      );
      const dailyEvents = await Transaction.query()
        .joinRelated('events[attributes]')
        .select(
          'id',
          'gas_used',
          'events:attributes.event_id',
          'events:attributes.composite_key',
          'events:attributes.value'
        )
        .where('timestamp', '>=', startTime)
        .andWhere('timestamp', '<', endTime)
        .andWhere((builder) =>
          builder.whereIn('events.type', [
            Event.EVENT_TYPE.COIN_SPENT,
            Event.EVENT_TYPE.COIN_RECEIVED,
            Event.EVENT_TYPE.USE_FEEGRANT,
          ])
        )
        .orWhereIn('events:attributes.key', [
          EventAttribute.ATTRIBUTE_KEY.FEE,
          EventAttribute.ATTRIBUTE_KEY.FEE_PAYER,
        ])
        .limit(config.accountStatistics.recordsPerCall)
        .offset(_payload.offset * config.accountStatistics.recordsPerCall);

      if (dailyEvents.length > 0) {
        dailyEvents
          .filter((event) => event.value.startsWith('aura'))
          .forEach((event) => {
            if (!accountStats.find((acc) => acc.address === event.value)) {
              accountStats.push({
                address: event.value,
                amount_sent: '0',
                amount_received: '0',
                tx_sent: 0,
                gas_used: '0',
              });
            }
          });

        dailyEvents
          .filter((event) => !event.value.startsWith('aura'))
          .forEach((event) => {
            switch (event.composite_key) {
              case EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_SPENT_AMOUNT:
                const addrSpent = dailyEvents.find(
                  (dEvent) =>
                    dEvent.event_id === event.event_id &&
                    dEvent.composite_key ===
                      EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_SPENT_SPENDER
                )?.value;

                const indexSpent = accountStats.indexOf(
                  accountStats.find((acc) => acc.address === addrSpent)!
                );

                accountStats[indexSpent].amount_sent = (
                  BigInt(accountStats[indexSpent].amount_sent) +
                  BigInt(parseCoins(event.value)[0].amount)
                ).toString();
                break;
              case EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_RECEIVED_AMOUNT:
                const addrReceived = dailyEvents.find(
                  (dEvent) =>
                    dEvent.event_id === event.event_id &&
                    dEvent.composite_key ===
                      EventAttribute.ATTRIBUTE_COMPOSITE_KEY
                        .COIN_RECEIVED_RECEIVER
                )?.value;

                const indexReceived = accountStats.indexOf(
                  accountStats.find((acc) => acc.address === addrReceived)!
                );

                accountStats[indexReceived].amount_received = (
                  BigInt(accountStats[indexReceived].amount_received) +
                  BigInt(parseCoins(event.value)[0].amount)
                ).toString();
                break;
              default:
                break;
            }
          });

        dailyEvents
          .filter(
            (event) =>
              event.composite_key ===
              EventAttribute.ATTRIBUTE_COMPOSITE_KEY.TX_FEE_PAYER
          )
          .forEach((event) => {
            let addr = event.value;

            const feeGrant = dailyEvents.find(
              (dEvent) =>
                dEvent.event_id === event.event_id &&
                dEvent.composite_key ===
                  EventAttribute.ATTRIBUTE_COMPOSITE_KEY.USE_FEEGRANT_GRANTEE
            );

            if (feeGrant) {
              addr = feeGrant.value;
            }

            const index = accountStats.indexOf(
              accountStats.find((acc) => acc.address === addr)!
            );
            accountStats[index].tx_sent += 1;
            accountStats[index].gas_used = (
              BigInt(accountStats[index].gas_used) + BigInt(event.gas_used)
            ).toString();
          });
        const offset = _payload.offset + 1;

        await this.createJob(
          BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
          BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
          {
            offset,
            accountStats,
          },
          {
            removeOnComplete: true,
            removeOnFail: {
              count: 3,
            },
          }
        );
      } else {
        const dailyAccountStats = accountStats.map((acc) =>
          AccountStatistics.fromJson({
            ...acc,
            date: new Date(startTime).toISOString(),
          })
        );

        await AccountStatistics.query()
          .insert(dailyAccountStats)
          .catch((error) => {
            this.logger.error(
              'Error insert new daily account statistic records'
            );
            this.logger.error(error);
          });

        await this.createJob(
          BULL_JOB_NAME.HANDLE_TOP_ACCOUNTS,
          BULL_JOB_NAME.HANDLE_TOP_ACCOUNTS,
          {},
          {
            removeOnComplete: true,
            removeOnFail: {
              count: 3,
            },
          }
        );
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_TOP_ACCOUNTS,
    jobName: BULL_JOB_NAME.HANDLE_TOP_ACCOUNTS,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleTopAccounts(_payload: object): Promise<void> {
    try {
      const syncDate = new Date();
      const now = syncDate.setUTCHours(0, 0, 0, 0);
      syncDate.setDate(syncDate.getDate() - 3);
      const threeDays = syncDate.setUTCHours(0, 0, 0, 0);
      syncDate.setDate(syncDate.getDate() - 15);
      const fifteenDays = syncDate.setUTCHours(0, 0, 0, 0);
      syncDate.setDate(syncDate.getDate() - 30);
      const thirtyDays = syncDate.setUTCHours(0, 0, 0, 0);

      const [threeDayStat, fifteenDayStat, thirtyDayStat] = await Promise.all([
        AccountStatistics.query()
          .select('address')
          .sum('amount_sent')
          .sum('amount_received')
          .sum('tx_sent')
          .sum('gas_used')
          .where('date', '>=', threeDays)
          .andWhere('date', '<', now)
          .groupBy('address'),
        AccountStatistics.query()
          .select('address')
          .sum('amount_sent')
          .sum('amount_received')
          .sum('tx_sent')
          .sum('gas_used')
          .where('date', '>=', fifteenDays)
          .andWhere('date', '<', now)
          .groupBy('address'),
        AccountStatistics.query()
          .select('address')
          .sum('amount_sent')
          .sum('amount_received')
          .sum('tx_sent')
          .sum('gas_used')
          .where('date', '>=', thirtyDays)
          .andWhere('date', '<', now)
          .groupBy('address'),
      ]);

      let topAccounts = await this.broker.cacher?.get(REDIS_KEY.TOP_ACCOUNTS);
      topAccounts = {
        three_days: this.calculateTop(threeDayStat),
        fifteen_days: this.calculateTop(fifteenDayStat),
        thirty_days: this.calculateTop(thirtyDayStat),
      };

      this.logger.info(`Update top accounts for day ${now}`);
      await this.broker.cacher?.set(REDIS_KEY.TOP_ACCOUNTS, topAccounts);
    } catch (error) {
      this.logger.error(error);
    }
  }

  private calculateTop(dayStat: AccountStatistics[]) {
    const newTopStat = {
      top_amount_sent: [] as any[],
      top_amount_received: [] as any[],
      top_tx_sent: [] as any[],
      top_gas_used: [] as any[],
    };
    dayStat.forEach((stat) => {
      newTopStat.top_amount_sent.push({
        address: stat.address,
        amount: stat.amount_sent,
        percentage: Number(
          (BigInt(stat.amount_sent) * BigInt(100)) /
            BigInt(
              dayStat
                .map((statistic) => statistic.amount_sent)
                .reduce((a: string, b: string) =>
                  (BigInt(a) + BigInt(b)).toString()
                )
            )
        ),
      });
      newTopStat.top_amount_received.push({
        address: stat.address,
        amount: stat.amount_received,
        percentage: Number(
          (BigInt(stat.amount_received) * BigInt(100)) /
            BigInt(
              dayStat
                .map((statistic) => statistic.amount_received)
                .reduce((a: string, b: string) =>
                  (BigInt(a) + BigInt(b)).toString()
                )
            )
        ),
      });
      newTopStat.top_tx_sent.push({
        address: stat.address,
        amount: stat.tx_sent,
        percentage:
          (stat.tx_sent * 100) /
          dayStat
            .map((statistic) => statistic.tx_sent)
            .reduce((a: number, b: number) => a + b),
      });
      newTopStat.top_gas_used.push({
        address: stat.address,
        amount: stat.gas_used,
        percentage: Number(
          (BigInt(stat.gas_used) * BigInt(100)) /
            BigInt(
              dayStat
                .map((statistic) => statistic.gas_used)
                .reduce((a: string, b: string) =>
                  (BigInt(a) + BigInt(b)).toString()
                )
            )
        ),
      });
    });
    newTopStat.top_amount_sent = newTopStat.top_amount_sent
      .sort((a, b) => a.percentage - b.percentage)
      .filter(
        (_, index) => index < config.accountStatistics.numberOfTopRecords
      );
    newTopStat.top_amount_received = newTopStat.top_amount_received
      .sort((a, b) => a.percentage - b.percentage)
      .filter(
        (_, index) => index < config.accountStatistics.numberOfTopRecords
      );
    newTopStat.top_tx_sent = newTopStat.top_tx_sent
      .sort((a, b) => a.percentage - b.percentage)
      .filter(
        (_, index) => index < config.accountStatistics.numberOfTopRecords
      );
    newTopStat.top_gas_used = newTopStat.top_gas_used
      .sort((a, b) => a.percentage - b.percentage)
      .filter(
        (_, index) => index < config.accountStatistics.numberOfTopRecords
      );

    return newTopStat;
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
      BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
      {
        id: 0,
        accountStats: [],
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          pattern: config.accountStatistics.jobPattern,
        },
      }
    );

    return super._start();
  }
}
