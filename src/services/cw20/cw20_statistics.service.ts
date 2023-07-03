import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, Config, SERVICE } from '../../common';
import {
  BlockCheckpoint,
  CW20TotalHolderStats,
  Cw20Contract,
} from '../../models';

export interface ICrawlCw20TotalHolderByContract {
  cw20ContractId: number;
}

const { NODE_ENV } = Config;
@Service({
  name: SERVICE.V1.Cw20Statistics.key,
  version: 1,
})
export default class CW20Statistics extends BullableService {
  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_CW20_TOTAL_HOLDER,
    jobName: BULL_JOB_NAME.CRAWL_CW20_TOTAL_HOLDER,
  })
  async jobHandleCrawlCw20TotalHolder(): Promise<void> {
    const cw20BlockCheckpoint = await BlockCheckpoint.query()
      .findOne({
        job_name: BULL_JOB_NAME.HANDLE_CW20,
      })
      .withGraphJoined('block')
      .throwIfNotFound();
    const { time }: { time: Date } = cw20BlockCheckpoint.block;
    if (this.isToday(time)) {
      const totalHolder = await Cw20Contract.query()
        .alias('cw20_contract')
        .joinRelated('holders')
        .where('cw20_contract.track', true)
        .andWhere('holders.amount', '>', 0)
        .count()
        .groupBy('holders.cw20_contract_id')
        .select('holders.cw20_contract_id');
      await CW20TotalHolderStats.query()
        .insert(
          totalHolder.map((e) =>
            CW20TotalHolderStats.fromJson({
              cw20_contract_id: e.cw20_contract_id,
              total_holder: e.count,
            })
          )
        )
        .onConflict(['cw20_contract_id', 'created_at'])
        .merge();
    } else {
      throw new Error('CW20 service not catch up on current');
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

  isToday(date: Date) {
    const today = new Date();
    if (today.toDateString() === date.toDateString()) {
      return true;
    }
    return false;
  }
}
