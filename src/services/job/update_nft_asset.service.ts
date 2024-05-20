import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import { CW721Contract, NftAsset } from '../../models';

@Service({
  name: SERVICE.V1.JobService.UpdateNftAssets.key,
  version: 1,
})
export default class UpdateNftAssetsJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_UPDATE_NFT_ASSETS,
    jobName: BULL_JOB_NAME.JOB_UPDATE_NFT_ASSETS,
  })
  async jobUpdateAssets() {
    const cw721Assets = await CW721Contract.query()
      .joinRelated('[cw721_contract_stats, smart_contract]')
      .select(
        'smart_contract.address',
        'cw721_contract_stats.total_activity',
        'cw721_contract_stats.transfer_24h'
      );
    const nftAssets: NftAsset[] = [];
    nftAssets.push(
      ...cw721Assets.map((cw721Asset) =>
        NftAsset.fromJson({
          ...cw721Asset,
          type: NftAsset.TYPE.CW721,
          updated_at: new Date(),
        })
      )
    );
    if (nftAssets.length > 0) {
      await NftAsset.query().insert(nftAssets).onConflict(['address']).merge();
    }
  }

  public async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.JOB_UPDATE_NFT_ASSETS,
      BULL_JOB_NAME.JOB_UPDATE_NFT_ASSETS,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobUpdateNftAssets.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
