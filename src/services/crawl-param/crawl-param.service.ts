import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { Param } from '../../models/param';
import { callApiMixin } from '../../mixin/callApi/call-api.mixin';
import {
  APP_CONSTANTS,
  BULL_JOB_NAME,
  MODULE_PARAM,
  SERVICE_NAME,
  URL_TYPE_CONSTANTS,
} from '../../common/constant';
import Utils from '../../common/utils/utils';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config } from '../../common';

@Service({
  name: SERVICE_NAME.CRAWL_PARAM,
  version: APP_CONSTANTS.VERSION_NUMBER,
  mixins: [callApiMixin],
})
export default class CrawlParamService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_PARAM,
    jobType: 'crawl',
    prefix: `horoscope-v2-${Config.CHAIN_ID}`,
  })
  private async handleJob(_payload: object): Promise<void> {
    const url = Utils.getUrlByChainIdAndType(
      Config.CHAIN_ID,
      URL_TYPE_CONSTANTS.LCD
    );

    const [
      paramBank,
      paramDistribution,
      paramGovVoting,
      paramGovTallying,
      paramGovDeposit,
      paramSlashing,
      paramStaking,
      paramIBCTransfer,
      paramMint,
    ] = await Promise.all([
      this.callApiFromDomain(url, Config.GET_PARAMS_BANK),
      this.callApiFromDomain(url, Config.GET_PARAMS_DISTRIBUTION),
      this.callApiFromDomain(url, Config.GET_PARAMS_GOV_VOTING),
      this.callApiFromDomain(url, Config.GET_PARAMS_GOV_TALLYING),
      this.callApiFromDomain(url, Config.GET_PARAMS_GOV_DEPOSIT),
      this.callApiFromDomain(url, Config.GET_PARAMS_SLASHING),
      this.callApiFromDomain(url, Config.GET_PARAMS_STAKING),
      this.callApiFromDomain(url, Config.GET_PARAMS_IBC_TRANSFER),
      this.callApiFromDomain(url, Config.GET_PARAMS_MINT),
    ]);

    this.logger.debug(`paramBank: ${JSON.stringify(paramBank)}`);
    this.logger.debug(
      `paramDistribution: ${JSON.stringify(paramDistribution)}`
    );
    this.logger.debug(`paramSlashing: ${JSON.stringify(paramSlashing)}`);
    this.logger.debug(`paramStaking: ${JSON.stringify(paramStaking)}`);
    this.logger.debug(`paramApiTransfer: ${JSON.stringify(paramIBCTransfer)}`);
    this.logger.debug(`paramMint: ${JSON.stringify(paramMint)}`);

    const paramGov = {
      type: 'gov',
      params: {
        voting_param: paramGovVoting.voting_params,
        tallying_param: paramGovTallying.tally_params,
        deposit_param: paramGovDeposit.deposit_params,
      },
    };
    this.logger.debug(`paramGov: ${JSON.stringify(paramGov)}`);

    const paramBankEntity: Param = Param.fromJson({
      module: MODULE_PARAM.BANK,
      params: paramBank.params,
    });
    const paramDistributionEntity: Param = Param.fromJson({
      module: MODULE_PARAM.DISTRIBUTION,
      params: paramDistribution.params,
    });
    const paramGovEntity: Param = Param.fromJson({
      module: MODULE_PARAM.GOVERNANCE,
      params: paramGov.params,
    });
    const paramSlashingEntity: Param = Param.fromJson({
      module: MODULE_PARAM.SLASHING,
      params: paramSlashing.params,
    });
    const paramStakingEntity: Param = Param.fromJson({
      module: MODULE_PARAM.STAKING,
      params: paramStaking.params,
    });
    const paramIbcTransferEntity: Param = Param.fromJson({
      module: MODULE_PARAM.IBC_TRANSFER,
      params: paramIBCTransfer.params,
    });
    const paramMintEntity: Param = Param.fromJson({
      module: MODULE_PARAM.MINT,
      params: paramMint.params,
    });

    await Promise.all([
      Param.query()
        .insert(paramBankEntity)
        .onConflict('module')
        .merge()
        .returning('id'),
      Param.query()
        .insert(paramDistributionEntity)
        .onConflict('module')
        .merge()
        .returning('id'),
      Param.query()
        .insert(paramGovEntity)
        .onConflict('module')
        .merge()
        .returning('id'),
      Param.query()
        .insert(paramSlashingEntity)
        .onConflict('module')
        .merge()
        .returning('id'),
      Param.query()
        .insert(paramStakingEntity)
        .onConflict('module')
        .merge()
        .returning('id'),
      Param.query()
        .insert(paramIbcTransferEntity)
        .onConflict('module')
        .merge()
        .returning('id'),
      Param.query()
        .insert(paramMintEntity)
        .onConflict('module')
        .merge()
        .returning('id'),
    ]);
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_PARAM,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: parseInt(Config.MILISECOND_CRAWL_PARAM, 10),
        },
      }
    );

    return super._start();
  }
}
