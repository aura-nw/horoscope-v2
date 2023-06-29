import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { CW20TotalHolderStats, Cw20Contract } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import { BULL_JOB_NAME, Config, SERVICE } from '../../common';

export interface ICrawlCw20TotalHolderByContract {
  cw20ContractId: number;
  cw20ContractAddress: string;
}

const { NODE_ENV } = Config;
@Service({
  name: SERVICE.V1.Cw20Statistics.key,
  version: 1,
})
export default class CW20Statistics extends BullableService {
  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_CW20_TOTAL_HOLDER_BY_CONTRACT,
    jobName: BULL_JOB_NAME.CRAWL_CW20_TOTAL_HOLDER_BY_CONTRACT,
  })
  async jobHandleCrawlCw20TotalHolderByContract(
    _payload: ICrawlCw20TotalHolderByContract
  ): Promise<void> {
    const { cw20ContractId, cw20ContractAddress } = _payload;
    const holders = await Cw20Contract.getAllHolders(cw20ContractAddress);
    await CW20TotalHolderStats.query()
      .insert(
        CW20TotalHolderStats.fromJson({
          cw20_contract_id: cw20ContractId,
          total_holder: holders.length,
        })
      )
      .onConflict(['cw20_contract_id', 'created_at'])
      .merge();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_CW20_TOTAL_HOLDER,
    jobName: BULL_JOB_NAME.CRAWL_CW20_TOTAL_HOLDER,
  })
  async jobHandleCrawlCw20TotalHolder(): Promise<void> {
    const cw20Contracts = await Cw20Contract.query()
      .withGraphJoined('smart_contract')
      .where('track', true);
    // eslint-disable-next-line no-restricted-syntax
    for (const cw20Contract of cw20Contracts) {
      this.logger.info(cw20Contract);
      // eslint-disable-next-line no-await-in-loop
      await this.createJob(
        BULL_JOB_NAME.CRAWL_CW20_TOTAL_HOLDER_BY_CONTRACT,
        BULL_JOB_NAME.CRAWL_CW20_TOTAL_HOLDER_BY_CONTRACT,
        {
          cw20ContractAddress: cw20Contract.smart_contract.address,
          cw20ContractId: cw20Contract.id,
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
  }

  async _start(): Promise<void> {
    if (NODE_ENV !== 'test') {
      await this.createJob(
        BULL_JOB_NAME.CRAWL_CW20_TOTAL_HOLDER,
        BULL_JOB_NAME.CRAWL_CW20_TOTAL_HOLDER,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          attempts: config.jobRetryAttempt,
          backoff: config.jobRetryBackoff,
          repeat: {
            pattern: '0 0 0 * * *',
          },
        }
      );
    }
    return super._start();
  }
}
