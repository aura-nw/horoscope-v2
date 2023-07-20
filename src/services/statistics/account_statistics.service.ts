/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { parseCoins } from '@cosmjs/proto-signing';
import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import _ from 'lodash';
import {
  AccountStatistics,
  Event,
  EventAttribute,
  Transaction,
} from '../../models';
import {
  BULL_JOB_NAME,
  IAccountStatsParam,
  ICreateSpecificDateJob,
  REDIS_KEY,
  SERVICE,
} from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import Utils from '../../common/utils/utils';

@Service({
  name: SERVICE.V1.AccountStatisticsService.key,
  version: 1,
})
export default class AccountStatisticsService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.AccountStatisticsService.CreateSpecificDateJob.key,
    params: {
      date: 'string',
    },
  })
  public async actionCreateSpecificDateJob(
    ctx: Context<ICreateSpecificDateJob>
  ) {
    await this.createJob(
      BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
      BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
      {
        id: null,
        date: ctx.params.date,
        accountStats: {},
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
    queueName: BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
    jobName: BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: IAccountStatsParam): Promise<void> {
    try {
      const { accountStats, date } = _payload;

      const startTime = dayjs
        .utc(date)
        .subtract(1, 'day')
        .startOf('day')
        .toDate();
      const endTime = dayjs.utc(date).startOf('day').toDate();

      const startTxId = !_payload.id
        ? (
            await Transaction.query()
              .select('id')
              .where('transaction.timestamp', '>=', startTime)
              .limit(1)
              .orderBy('id')
          )[0].id
        : _payload.id;
      const nextId = startTxId + 50;
      this.logger.info(
        `Get account statistic events from id ${startTxId} for day ${new Date(
          startTime
        )}`
      );

      const dailyEvents = await Transaction.query()
        .joinRelated('events.[attributes]')
        .select(
          'transaction.gas_used',
          'events:attributes.event_id',
          'events:attributes.composite_key',
          'events:attributes.value'
        )
        .where('transaction.timestamp', '>=', startTime)
        .andWhere('transaction.timestamp', '<', endTime)
        .andWhere('transaction.id', '>=', startTxId)
        .andWhere('transaction.id', '<', nextId)
        .andWhere((builder) =>
          builder
            // Get the address that actually spent or received token
            .whereIn('events.type', [
              Event.EVENT_TYPE.COIN_SPENT,
              Event.EVENT_TYPE.COIN_RECEIVED,
              Event.EVENT_TYPE.USE_FEEGRANT,
            ])
            // If fee_grant is involved, then needs these to track to the granters
            .orWhereIn('events:attributes.key', [
              EventAttribute.ATTRIBUTE_KEY.FEE,
              EventAttribute.ATTRIBUTE_KEY.FEE_PAYER,
            ])
        );

      if (dailyEvents.length > 0) {
        dailyEvents
          .filter(
            (event) =>
              Utils.isValidAccountAddress(
                event.value,
                config.networkPrefixAddress,
                20
              ) ||
              Utils.isValidAccountAddress(
                event.value,
                config.networkPrefixAddress,
                32
              )
          )
          .forEach((event) => {
            if (!accountStats[event.value]) {
              accountStats[event.value] = {
                amount_sent: '0',
                amount_received: '0',
                tx_sent: 0,
                gas_used: '0',
              };
            }
          });

        dailyEvents
          .filter(
            (event) =>
              !Utils.isValidAccountAddress(
                event.value,
                config.networkPrefixAddress,
                20
              )
          )
          .forEach((event) => {
            switch (event.composite_key) {
              case EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_SPENT_AMOUNT:
                const addrSpent = dailyEvents.find(
                  (dEvent) =>
                    dEvent.event_id === event.event_id &&
                    dEvent.composite_key ===
                      EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_SPENT_SPENDER
                )?.value;

                accountStats[addrSpent].amount_sent = (
                  BigInt(accountStats[addrSpent].amount_sent) +
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

                accountStats[addrReceived].amount_received = (
                  BigInt(accountStats[addrReceived].amount_received) +
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

            accountStats[addr].tx_sent += 1;
            accountStats[addr].gas_used = (
              BigInt(accountStats[addr].gas_used) + BigInt(event.gas_used)
            ).toString();
          });

        await this.createJob(
          BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
          BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
          {
            id: nextId,
            date: _payload.date,
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
        const dailyAccountStats = Object.keys(accountStats).map((acc) =>
          AccountStatistics.fromJson({
            address: acc,
            ...accountStats[acc],
            date: startTime.toISOString(),
          })
        );

        this.logger.info(`Insert new daily statistic for date ${startTime}`);
        if (dailyAccountStats.length > 0) {
          await AccountStatistics.query()
            .insert(dailyAccountStats)
            .catch((error) => {
              this.logger.error(
                'Error insert new daily account statistic records'
              );
              this.logger.error(error);
            });
        }

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
      const now = dayjs.utc().startOf('day').toDate();

      const { dayRange } = config.accountStatistics;
      const [threeDayStat, fifteenDayStat, thirtyDayStat] = await Promise.all([
        this.getStatsFromSpecificDaysAgo(dayRange[0], now),
        this.getStatsFromSpecificDaysAgo(dayRange[1], now),
        this.getStatsFromSpecificDaysAgo(dayRange[2], now),
      ]);

      const topAccounts = {
        three_days: this.calculateTop(threeDayStat),
        fifteen_days: this.calculateTop(fifteenDayStat),
        thirty_days: this.calculateTop(thirtyDayStat),
      };

      this.logger.info(`Update top accounts for day ${new Date(now)}`);
      await this.broker.cacher?.set(REDIS_KEY.TOP_ACCOUNTS, topAccounts);
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async getStatsFromSpecificDaysAgo(
    daysAgo: number,
    endTime: Date
  ): Promise<AccountStatistics[]> {
    const startTime = dayjs
      .utc()
      .subtract(daysAgo, 'day')
      .startOf('day')
      .toDate();

    const result = await AccountStatistics.query()
      .select('address')
      .sum('amount_sent as amount_sent')
      .sum('amount_received as amount_received')
      .sum('tx_sent as tx_sent')
      .sum('gas_used as gas_used')
      .where('date', '>=', startTime)
      .andWhere('date', '<', endTime)
      .groupBy('address');

    return result;
  }

  private calculateTop(dayStat: AccountStatistics[]) {
    let topAmountSent: any[] = [];
    let topAmountReceived: any[] = [];
    let topTxSent: any[] = [];
    let topGasUsed: any[] = [];

    const dayStatAmountSent = dayStat
      .reduce(
        (init: bigint, accStat: AccountStatistics) =>
          init + BigInt(accStat.amount_sent),
        BigInt(0)
      )
      .toString();
    const dayStatAmountReceived = dayStat
      .reduce(
        (init: bigint, accStat: AccountStatistics) =>
          init + BigInt(accStat.amount_received),
        BigInt(0)
      )
      .toString();
    const dayStatTxSent = dayStat.reduce(
      (init: number, accStat: AccountStatistics) => init + accStat.tx_sent,
      0
    );
    const dayStatGasUsed = dayStat
      .reduce(
        (init: bigint, accStat: AccountStatistics) =>
          init + BigInt(accStat.gas_used),
        BigInt(0)
      )
      .toString();

    dayStat.forEach((stat) => {
      topAmountSent.push({
        address: stat.address,
        amount: stat.amount_sent,
        percentage: Number(
          BigNumber(stat.amount_sent)
            .multipliedBy(100)
            .dividedBy(BigNumber(dayStatAmountSent))
        ),
      });
      topAmountReceived.push({
        address: stat.address,
        amount: stat.amount_received,
        percentage: Number(
          BigNumber(stat.amount_received)
            .multipliedBy(100)
            .dividedBy(BigNumber(dayStatAmountReceived))
        ),
      });
      topTxSent.push({
        address: stat.address,
        amount: stat.tx_sent,
        percentage: (stat.tx_sent * 100) / dayStatTxSent,
      });
      topGasUsed.push({
        address: stat.address,
        amount: stat.gas_used,
        percentage: Number(
          BigNumber(stat.gas_used)
            .multipliedBy(100)
            .dividedBy(BigNumber(dayStatGasUsed))
        ),
      });
    });

    topAmountSent = _.orderBy(topAmountSent, 'percentage', 'desc').slice(
      0,
      config.accountStatistics.numberOfTopRecords
    );
    topAmountReceived = _.orderBy(
      topAmountReceived,
      'percentage',
      'desc'
    ).slice(0, config.accountStatistics.numberOfTopRecords);
    topTxSent = _.orderBy(topTxSent, 'percentage', 'desc').slice(
      0,
      config.accountStatistics.numberOfTopRecords
    );
    topGasUsed = _.orderBy(topGasUsed, 'percentage', 'desc').slice(
      0,
      config.accountStatistics.numberOfTopRecords
    );

    return {
      top_amount_sent: topAmountSent,
      top_amount_received: topAmountReceived,
      top_tx_sent: topTxSent,
      top_gas_used: topGasUsed,
    };
  }

  public async _start() {
    dayjs.extend(utc);

    return super._start();
  }
}
