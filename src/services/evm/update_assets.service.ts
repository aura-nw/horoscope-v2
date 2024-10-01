import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from './constant';
import { Asset } from '../../models/asset';
import { Erc20Contract } from '../../models/erc20_contract';
import { BlockCheckpoint } from '../../models';
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.JobService.UpdateEvmAssets.key,
  version: 1,
})
export default class UpdateEvmAssetsJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_UPDATE_EVM_ASSETS,
    jobName: BULL_JOB_NAME.JOB_UPDATE_EVM_ASSETS,
  })
  async jobUpdateEvmAssets() {
    const [startBlock, endBlock, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.UPDATE_EVM_ASSETS,
        [BULL_JOB_NAME.HANDLE_ERC20_BALANCE],
        config.jobUpdateAssets.key
      );
    const erc20Assets = await Erc20Contract.query()
      .where('last_updated_height', '>', startBlock)
      .andWhere('last_updated_height', '<=', endBlock);
    const assets: Asset[] = [];
    assets.push(
      ...erc20Assets.map((erc20Asset) =>
        Asset.fromJson({
          denom: erc20Asset.address,
          type: Asset.TYPE.ERC20_TOKEN,
          decimal: erc20Asset.decimal,
          name: erc20Asset.name,
          total_supply: erc20Asset.total_supply,
          origin_id: erc20Asset.evm_smart_contract_id,
          updated_at: new Date().toISOString(),
        })
      )
    );
    await knex.transaction(async (trx) => {
      if (assets.length > 0) {
        await Asset.query()
          .insert(assets)
          .onConflict('denom')
          .merge()
          .transacting(trx);
      }
      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
  }

  public async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.JOB_UPDATE_EVM_ASSETS,
      BULL_JOB_NAME.JOB_UPDATE_EVM_ASSETS,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobUpdateAssets.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
