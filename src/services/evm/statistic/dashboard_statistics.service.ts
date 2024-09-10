/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import axios from 'axios';
import {
  BlockCheckpoint,
  DailyStatistics,
  EVMBlock,
  EVMTransaction,
  Statistic,
  StatisticKey,
} from '../../../models';
import { BULL_JOB_NAME, REDIS_KEY, SERVICE } from '../constant';
import config from '../../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../../base/bullable.service';
import networks from '../../../../network.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.DashboardEVMStatisticsService.key,
  version: 1,
})
export default class DashboardEVMStatisticsService extends BullableService {
  private selectedChain: any = networks.find(
    (network) => network.chainId === config.chainId
  );

  private _lcd = this.selectedChain.LCD[0];

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  /**
   * @description: update statistic transaction and return current total transaction counted
   * @private
   */
  private async statisticTotalTransaction(): Promise<number> {
    // Select and make sure that have statistic
    const totalTxStatistic: Statistic | undefined =
      await Statistic.query().findOne('key', StatisticKey.TotalTransaction);

    // Count transaction and get max height from height to height
    const crawlTxJobInfo = await BlockCheckpoint.query().findOne(
      'job_name',
      config.evmOnly
        ? BULL_JOB_NAME.CRAWL_EVM_TRANSACTION
        : BULL_JOB_NAME.HANDLE_TRANSACTION_EVM
    );
    if (!crawlTxJobInfo) return 0;

    if (!totalTxStatistic) {
      const transactionsInfo = await EVMTransaction.query()
        .where('height', '<=', crawlTxJobInfo.height)
        .count();
      this.logger.info(transactionsInfo);
      const totalTransaction = transactionsInfo ? transactionsInfo[0].count : 0;
      await Statistic.query().insert({
        key: StatisticKey.TotalTransaction,
        value: totalTransaction,
        statistic_since: `${crawlTxJobInfo.height}`,
      });
      return totalTransaction;
    }
    let totalTx = Number(totalTxStatistic?.value);

    // Count tx and find max height determine by range of statistic
    const fromHeight = Number(totalTxStatistic?.statistic_since);
    const toHeight = crawlTxJobInfo.height;

    if (fromHeight >= toHeight) return totalTx;

    const txStatistic = await EVMTransaction.query()
      .where('height', '>', fromHeight)
      .andWhere('height', '<=', toHeight)
      .count();

    // If having new tx, then update total tx and update counter since for next time statistic
    if (txStatistic[0]) {
      totalTx += Number(txStatistic[0].count);
      await Statistic.query()
        .update(
          Statistic.fromJson({
            key: StatisticKey.TotalTransaction,
            value: totalTx,
            statistic_since: toHeight,
          })
        )
        .where({
          key: StatisticKey.TotalTransaction,
        });
    }

    return totalTx;
  }

  async avgBlockTime() {
    const last100Block = await EVMBlock.query()
      .orderBy('height', 'desc')
      .limit(100);
    if (last100Block.length === 0) return 0;
    const avgTime =
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      (last100Block[0].timestamp -
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        last100Block[last100Block.length - 1].timestamp) /
      last100Block.length;
    return avgTime;
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_DASHBOARD_EVM_STATISTICS,
    jobName: BULL_JOB_NAME.HANDLE_DASHBOARD_EVM_STATISTICS,
  })
  public async handleJob(_payload: object): Promise<void> {
    this.logger.info('Update EVM dashboard statistics');

    const [
      totalBlocks,
      totalTxs,
      avgBlockTime,
      latestDailyStat,
      totalSupply,
      bondedTokens,
    ] = await Promise.all([
      BlockCheckpoint.query().findOne(
        'job_name',
        config.evmOnly
          ? BULL_JOB_NAME.CRAWL_EVM_TRANSACTION
          : BULL_JOB_NAME.HANDLE_TRANSACTION_EVM
      ),
      this.statisticTotalTransaction(),
      this.avgBlockTime(),
      DailyStatistics.query().orderBy('date', 'desc').first(),
      this.getTotalSupplyByDenom(),
      this.getBondedTokenInStakingPool(),
    ]);

    const dashboardStatistics = {
      total_blocks: totalBlocks?.height,
      total_transactions: Number(totalTxs),
      avg_block_time: avgBlockTime,
      addresses: latestDailyStat ? latestDailyStat.unique_addresses : 0,
      daily_transaction: latestDailyStat ? latestDailyStat.daily_txs : 0,
      total_supply: totalSupply,
      staking_apr: BigNumber(config.dashboardStatistics.currentInflation)
        .multipliedBy(
          BigNumber(1 - config.dashboardStatistics.currentCommunityTax)
        )
        .multipliedBy(BigNumber(totalSupply))
        .dividedBy(bondedTokens)
        .multipliedBy(100),
    };

    await this.broker.cacher?.set(
      REDIS_KEY.DASHBOARD_EVM_STATISTICS,
      dashboardStatistics
    );
  }

  async getBondedTokenInStakingPool() {
    if (!this._lcd) {
      this.logger.error('Config network not have LCD');
      return 0;
    }
    const resultCallApi = await axios({
      baseURL: this._lcd,
      url: 'staking/pool',
      method: 'GET',
      params: {
        denom: config.dashboardStatistics.denomSupply,
      },
    });
    return resultCallApi.data.msg.pool.bonded_tokens;
  }

  async getTotalSupplyByDenom() {
    if (!this._lcd) {
      this.logger.error('Config network not have LCD');
      return 0;
    }
    const resultCallApi = await axios({
      baseURL: this._lcd,
      url: '/bank/supply/by_denom',
      method: 'GET',
      params: {
        denom: config.dashboardStatistics.denomSupply,
      },
    });
    return resultCallApi.data.msg.amount.amount;
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.HANDLE_DASHBOARD_EVM_STATISTICS,
      BULL_JOB_NAME.HANDLE_DASHBOARD_EVM_STATISTICS,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.dashboardStatistics.millisecondCrawl,
        },
      }
    );

    return super._start();
  }
}
