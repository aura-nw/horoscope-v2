import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import knex from '../../common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';

@Service({
  name: SERVICE.V1.IbcStatistic.key,
  version: 1,
})
export default class IbcStatisticService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.REFRESH_IBC_RELAYER_STATISTIC,
    jobName: BULL_JOB_NAME.REFRESH_IBC_RELAYER_STATISTIC,
  })
  public async refreshIbcRelayerStatistic(): Promise<void> {
    await knex.schema.refreshMaterializedView('m_view_ibc_relayer_statistic');
  }

  async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.REFRESH_IBC_RELAYER_STATISTIC,
      BULL_JOB_NAME.REFRESH_IBC_RELAYER_STATISTIC,
      {},
      {
        removeOnComplete: 1,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          pattern: config.ibcStatistic.timeRefreshIbcRelayerStats,
        },
      }
    );
    return super._start();
  }
}
