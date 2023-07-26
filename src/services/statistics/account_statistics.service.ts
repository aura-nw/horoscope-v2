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
import { AccountStatistics, EventAttribute, Transaction } from '../../models';
import {
  BULL_JOB_NAME,
  IAccountStatsParam,
  ICreateSpecificDateJob,
  REDIS_KEY,
  SERVICE,
} from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.AccountStatisticsService.key,
  version: 1,
})
export default class AccountStatisticsService extends BullableService {
  private accountStats: any;

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
        startId: null,
        endId: null,
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
    const { date } = _payload;
    this.accountStats = _payload.accountStats;

    const endTime = dayjs.utc(date).startOf('day').toDate();
    const startTime = dayjs.utc(endTime).subtract(1, 'day').toDate();

    let startTxId = _payload.startId;
    // The end tx's ID needs to plus 1 since the query will select record with _lt not _lte
    let nextId = Math.min(_payload.endId + 1, startTxId + 50);
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
      // The end tx's ID needs to plus 1 since the query will select record with _lt not _lte
      nextId = Math.min(endTx[0].id + 1, startTxId + 50);
      endTxId = endTx[0].id;
    }
    this.logger.info(
      `Get account statistic events from id ${startTxId} for day ${new Date(
        startTime
      )}`
    );

    const [spendReceiveDone, gasTxSentDone] = await Promise.all([
      this.calculateSpendReceive(startTxId, nextId),
      this.calculateGasUsedTxSent(startTxId, nextId),
    ]);

    if (!spendReceiveDone || !gasTxSentDone) {
      await this.createJob(
        BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
        BULL_JOB_NAME.CRAWL_ACCOUNT_STATISTICS,
        {
          startId: nextId,
          endId: endTxId,
          date: _payload.date,
          accountStats: this.accountStats,
        },
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
        }
      );
    } else {
      const dailyAccountStats = Object.keys(this.accountStats).map((acc) =>
        AccountStatistics.fromJson({
          address: acc,
          ...this.accountStats[acc],
          date: startTime.toISOString(),
        })
      );

      this.logger.info(`Insert new account statistics for date ${startTime}`);
      if (dailyAccountStats.length > 0) {
        await AccountStatistics.query().insert(dailyAccountStats);
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
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_TOP_ACCOUNTS,
    jobName: BULL_JOB_NAME.HANDLE_TOP_ACCOUNTS,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleTopAccounts(_payload: object): Promise<void> {
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
  }

  private async calculateSpendReceive(
    startTxId: number,
    nextId: number
  ): Promise<boolean> {
    const dailyEvents: any[] = await EventAttribute.query()
      .select(knex.raw('jsonb_agg(jsonb_build_object(composite_key, value))'))
      .where('tx_id', '>=', startTxId)
      .andWhere('tx_id', '<', nextId)
      .andWhere((builder) =>
        builder
          // Get the address that actually spent or received token
          .whereIn('composite_key', [
            EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_SPENT_SPENDER,
            EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_SPENT_AMOUNT,
            EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_RECEIVED_AMOUNT,
            EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_RECEIVED_RECEIVER,
          ])
      )
      .groupBy('event_id');

    if (dailyEvents.length > 0) {
      dailyEvents
        .map((event) => Object.assign({}, ...event.jsonb_agg))
        .map(
          (event) =>
            event[EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_SPENT_SPENDER] ??
            event[EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_RECEIVED_RECEIVER]
        )
        .forEach((address) => {
          if (!this.accountStats[address]) {
            this.accountStats[address] = {
              amount_sent: '0',
              amount_received: '0',
              tx_sent: 0,
              gas_used: '0',
            };
          }
        });

      dailyEvents
        .map((event) => Object.assign({}, ...event.jsonb_agg))
        .forEach((event) => {
          if (
            event[EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_SPENT_SPENDER]
          ) {
            const addrSpent =
              event[EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_SPENT_SPENDER];
            const amountSpent =
              event[EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_SPENT_AMOUNT];

            this.accountStats[addrSpent].amount_sent = (
              BigInt(this.accountStats[addrSpent].amount_sent) +
              BigInt(parseCoins(amountSpent)[0].amount)
            ).toString();
          } else if (
            event[EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_RECEIVED_RECEIVER]
          ) {
            const addrReceived =
              event[
                EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_RECEIVED_RECEIVER
              ];
            const amountReceived =
              event[
                EventAttribute.ATTRIBUTE_COMPOSITE_KEY.COIN_RECEIVED_AMOUNT
              ];

            this.accountStats[addrReceived].amount_received = (
              BigInt(this.accountStats[addrReceived].amount_received) +
              BigInt(parseCoins(amountReceived)[0].amount)
            ).toString();
          }
        });

      return false;
    }

    return true;
  }

  private async calculateGasUsedTxSent(
    startTxId: number,
    nextId: number
  ): Promise<boolean> {
    const feeEvents: any[] = await EventAttribute.query()
      .joinRelated('transaction')
      .select(
        knex.raw('jsonb_agg(jsonb_build_object(composite_key, value))'),
        'gas_used'
      )
      .where('tx_id', '>=', startTxId)
      .andWhere('tx_id', '<', nextId)
      .andWhere((builder) =>
        builder
          // If fee_grant is involved, then needs to track to the granters and grantees
          .whereIn('composite_key', [
            EventAttribute.ATTRIBUTE_COMPOSITE_KEY.TX_FEE_PAYER,
            EventAttribute.ATTRIBUTE_COMPOSITE_KEY.USE_FEEGRANT_GRANTEE,
          ])
      )
      .groupBy('tx_id', 'gas_used');

    if (feeEvents.length > 0) {
      feeEvents
        .map((event) => Object.assign({}, ...event.jsonb_agg))
        .map(
          (event) =>
            event[EventAttribute.ATTRIBUTE_COMPOSITE_KEY.TX_FEE_PAYER] ??
            event[EventAttribute.ATTRIBUTE_COMPOSITE_KEY.USE_FEEGRANT_GRANTEE]
        )
        .forEach((address) => {
          if (!this.accountStats[address]) {
            this.accountStats[address] = {
              amount_sent: '0',
              amount_received: '0',
              tx_sent: 0,
              gas_used: '0',
            };
          }
        });

      feeEvents
        .map((event) =>
          Object.assign({ gas_used: event.gas_used }, ...event.jsonb_agg)
        )
        .forEach((event) => {
          let addr = event[EventAttribute.ATTRIBUTE_COMPOSITE_KEY.TX_FEE_PAYER];

          if (
            event[EventAttribute.ATTRIBUTE_COMPOSITE_KEY.USE_FEEGRANT_GRANTEE]
          ) {
            addr =
              event[
                EventAttribute.ATTRIBUTE_COMPOSITE_KEY.USE_FEEGRANT_GRANTEE
              ];
          }

          this.accountStats[addr].tx_sent += 1;
          this.accountStats[addr].gas_used = (
            BigInt(this.accountStats[addr].gas_used) + BigInt(event.gas_used)
          ).toString();
        });

      return false;
    }

    return true;
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
