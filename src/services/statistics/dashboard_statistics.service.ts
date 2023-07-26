/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { DecCoinSDKType } from '@aura-nw/aurajs/types/codegen/cosmos/base/v1beta1/coin';
import BigNumber from 'bignumber.js';
import { BlockCheckpoint, Transaction, Validator } from '../../models';
import {
  BULL_JOB_NAME,
  IAuraJSClientFactory,
  REDIS_KEY,
  SERVICE,
  getLcdClient,
} from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';

@Service({
  name: SERVICE.V1.DashboardStatisticsService.key,
  version: 1,
})
export default class DashboardStatisticsService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_DASHBOARD_STATISTICS,
    jobName: BULL_JOB_NAME.HANDLE_DASHBOARD_STATISTICS,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    this.logger.info('Update AuraScan dashboard statistics');
    this._lcdClient = await getLcdClient();

    const [totalBlocks, totalTxs, totalValidators] = await Promise.all([
      BlockCheckpoint.query().findOne('job_name', BULL_JOB_NAME.CRAWL_BLOCK),
      Transaction.query().count('id'),
      Validator.query(),
    ]);

    const [communityPool, inflation, distribution, supply] = await Promise.all([
      this._lcdClient.auranw.cosmos.distribution.v1beta1.communityPool(),
      this._lcdClient.auranw.cosmos.mint.v1beta1.inflation(),
      this._lcdClient.auranw.cosmos.distribution.v1beta1.params(),
      this._lcdClient.auranw.cosmos.bank.v1beta1.supplyOf({
        denom: config.networkDenom,
      }),
    ]);
    let bondedTokens = BigInt(0);
    totalValidators
      .filter(
        (val) => val.status === Validator.STATUS.BONDED && val.jailed === false
      )
      .forEach((val) => {
        bondedTokens += BigInt(val.tokens);
      });
    const totalAura = supply.amount.amount;

    const dashboardStatistics = {
      total_blocks: totalBlocks?.height,
      community_pool: communityPool.pool.find(
        (pool: DecCoinSDKType) => pool.denom === config.networkDenom
      ).amount,
      total_transactions: Number(totalTxs[0].count),
      total_validators: totalValidators.length,
      total_active_validators: totalValidators.filter(
        (val) => val.status === Validator.STATUS.BONDED
      ).length,
      total_inactive_validators: totalValidators.filter(
        (val) => val.status === Validator.STATUS.UNBONDED
      ).length,
      bonded_tokens: bondedTokens.toString(),
      inflation: inflation.inflation,
      total_aura: totalAura,
      staking_apr: Number(
        BigNumber(inflation.inflation)
          .multipliedBy(
            BigNumber(1 - Number(distribution.params.community_tax))
          )
          .multipliedBy(BigNumber(totalAura))
          .dividedBy(BigNumber(bondedTokens.toString()))
          .multipliedBy(100)
      ),
    };

    await this.broker.cacher?.set(
      REDIS_KEY.DASHBOARD_STATISTICS,
      dashboardStatistics
    );
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.HANDLE_DASHBOARD_STATISTICS,
      BULL_JOB_NAME.HANDLE_DASHBOARD_STATISTICS,
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
