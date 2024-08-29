/* eslint-disable no-param-reassign */
/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import _ from 'lodash';
import {
  AccountStatistics,
  EVMBlock,
  EVMTransaction,
  EvmInternalTransaction,
} from '../../../models';
import { BULL_JOB_NAME, REDIS_KEY, SERVICE } from '../constant';
import config from '../../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../../base/bullable.service';
import knex from '../../../common/utils/db_connection';

dayjs.extend(utc);

@Service({
  name: SERVICE.V1.EVMAccountStatisticsService.key,
  version: 1,
})
export default class EVMAccountStatisticsService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.EVMAccountStatisticsService.CreateSpecificDateJob.key,
    params: {
      date: 'string',
    },
  })
  public async actionCreateSpecificDateJob(ctx: Context<{ date: string }>) {
    await this.createJob(
      BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_STATISTICS,
      BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_STATISTICS,
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
    queueName: BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_STATISTICS,
    jobName: BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_STATISTICS,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: { date: string }): Promise<void> {
    const { date } = _payload;
    const accountStats: any = {};

    const endTime = dayjs.utc(date).startOf('day').toDate();
    const startTime = dayjs.utc(endTime).subtract(1, 'day').toDate();

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

    this.logger.info(
      `Get account statistic events for day ${new Date(startTime)}`
    );

    await this.calculateSpendReceiveGasUsedTxSent(
      startBlock[0].height,
      endBlock[0].height,
      accountStats,
      startTime.toISOString()
    );

    const dailyAccountStats = Object.keys(accountStats).map(
      (acc) => accountStats[acc]
    );

    this.logger.info(`Insert new account statistics for date ${startTime}`);
    if (dailyAccountStats.length > 0) {
      await knex.batchInsert(
        AccountStatistics.tableName,
        dailyAccountStats,
        config.dailyEVMStatsJobs.crawlAccountStat.chunkSize
      );
    }

    await this.createJob(
      BULL_JOB_NAME.HANDLE_TOP_EVM_ACCOUNT,
      BULL_JOB_NAME.HANDLE_TOP_EVM_ACCOUNT,
      {},
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
    queueName: BULL_JOB_NAME.HANDLE_TOP_EVM_ACCOUNT,
    jobName: BULL_JOB_NAME.HANDLE_TOP_EVM_ACCOUNT,
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
    await this.broker.cacher?.set(REDIS_KEY.TOP_EVM_ACCOUNTS, topAccounts);
  }

  private async calculateSpendReceiveGasUsedTxSent(
    startHeight: number,
    endHeight: number,
    accountStats: any,
    date: string
  ) {
    const [fromTx, toTx] = await Promise.all([
      EVMTransaction.query()
        .select('id')
        .findOne('height', '>=', startHeight)
        .orderBy('height', 'asc')
        .orderBy('index', 'asc')
        .limit(1),
      EVMTransaction.query()
        .select('id')
        .findOne('height', '<=', endHeight)
        .orderBy('height', 'desc')
        .orderBy('index', 'desc')
        .limit(1),
    ]);
    if (!fromTx || !toTx) {
      return;
    }
    const dailyTxs = await EVMTransaction.query()
      .where('height', '>=', startHeight)
      .andWhere('height', '<=', endHeight)
      .orderBy('height', 'asc')
      .orderBy('index', 'asc')
      .withGraphFetched('[evm_internal_transactions]')
      .modifyGraph('evm_internal_transactions', (builder) => {
        builder
          .andWhere('evm_tx_id', '>=', fromTx.id)
          .andWhere('evm_tx_id', '<=', toTx.id);
      });
    dailyTxs.forEach((tx) => {
      if (!accountStats[tx.from]) {
        accountStats[tx.from] = AccountStatistics.newAccountStat(tx.from, date);
      }
      accountStats[tx.from].tx_sent += 1;

      accountStats[tx.from].gas_used = (
        BigInt(accountStats[tx.from].gas_used) + BigInt(tx.gas_used)
      ).toString();

      tx.evm_internal_transactions.forEach(
        (txInternal: EvmInternalTransaction) => {
          const { from, to } = txInternal;
          if (from) {
            if (!accountStats[from]) {
              accountStats[from] = AccountStatistics.newAccountStat(from, date);
            }
            accountStats[from].amount_sent = (
              BigInt(accountStats[from].amount_sent) + BigInt(txInternal.value)
            ).toString();
          }
          if (to) {
            if (!accountStats[to]) {
              accountStats[to] = AccountStatistics.newAccountStat(to, date);
            }

            accountStats[to].amount_received = (
              BigInt(accountStats[to].amount_received) +
              BigInt(txInternal.value)
            ).toString();
          }
        }
      );
    });
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
    const dayStatTxSent = dayStat
      .reduce(
        (init: bigint, accStat: AccountStatistics) =>
          init + BigInt(accStat.tx_sent),
        BigInt(0)
      )
      .toString();
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
        percentage: Number(
          BigNumber(stat.tx_sent)
            .multipliedBy(100)
            .dividedBy(BigNumber(dayStatTxSent))
        ),
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
}
