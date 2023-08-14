import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import CW721Activity from '../../models/cw721_tx';
import { ICw721ReindexingHistoryParams } from '../cw721/cw721.service';

@Service({
  name: SERVICE.V1.JobService.ReindexCw721ActivityMissingSce.key,
  version: 1,
})
export default class ReindexCw721ActivityMissingSce extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  public async _start(): Promise<void> {
    await this.broker.waitForServices(SERVICE.V1.Cw721.name);
    const maxHeightErr = (
      await CW721Activity.query()
        .whereNull('smart_contract_event_id')
        .max('height')
    )[0].max;
    await CW721Activity.query().delete().where('height', '<=', maxHeightErr);
    await this.createJob(
      BULL_JOB_NAME.REINDEX_CW721_HISTORY,
      BULL_JOB_NAME.REINDEX_CW721_HISTORY,
      {
        smartContractId: undefined,
        startBlock: config.crawlBlock.startBlock,
        endBlock: maxHeightErr,
        prevId: 0,
        contractAddress: '',
      } satisfies ICw721ReindexingHistoryParams,
      {
        removeOnComplete: true,
      }
    );
  }
}
