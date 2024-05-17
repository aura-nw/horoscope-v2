import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Erc721Contract, NftAsset } from '../../models';
import { BULL_JOB_NAME, SERVICE } from './constant';

@Service({
  name: SERVICE.V1.JobService.UpdateEvmNftAssets.key,
  version: 1,
})
export default class UpdateEvmNftAssetsJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_UPDATE_EVM_NFT_ASSETS,
    jobName: BULL_JOB_NAME.JOB_UPDATE_EVM_NFT_ASSETS,
  })
  async jobUpdateAssets() {
    const erc721Assets = await Erc721Contract.query()
      .joinRelated('erc721_stats')
      .select(
        'erc721_contract.address',
        'erc721_stats.total_activity',
        'erc721_stats.transfer_24h'
      );
    const nftAssets: NftAsset[] = [];
    nftAssets.push(
      ...erc721Assets.map((erc721Asset) =>
        NftAsset.fromJson({
          ...erc721Asset,
          type: NftAsset.TYPE.ERC721,
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
      BULL_JOB_NAME.JOB_UPDATE_EVM_NFT_ASSETS,
      BULL_JOB_NAME.JOB_UPDATE_EVM_NFT_ASSETS,
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
