import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import _ from 'lodash';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  IContextReindexingServiceHistory,
  SERVICE,
} from '../../common';
import { SmartContract } from '../../models';
import CW721Contract from '../../models/cw721_contract';
import CW721ContractStats from '../../models/cw721_stats';
import CW721Token from '../../models/cw721_token';
import CW721Activity from '../../models/cw721_tx';
import { ICw721ReindexingHistoryParams } from './cw721.service';

export interface IAddressParam {
  contractAddresses: string[];
  type: string;
}

interface ICw721ReindexingServiceParams {
  contractAddress: string;
  smartContractId: number;
  type: string;
}

export const REINDEX_TYPE = {
  ALL: 'all',
  HISTORY: 'history',
};

@Service({
  name: SERVICE.V1.CW721ReindexingService.key,
  version: 1,
})
export default class CW721ReindexingService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.REINDEX_CW721_CONTRACT,
    jobName: BULL_JOB_NAME.REINDEX_CW721_CONTRACT,
  })
  async jobHandler(_payload: ICw721ReindexingServiceParams): Promise<void> {
    const { smartContractId, contractAddress, type } = _payload;
    if (type === REINDEX_TYPE.ALL) {
      await this.handleReindexAll(smartContractId, contractAddress);
    } else if (type === REINDEX_TYPE.HISTORY) {
      await this.handleReindexHistory(smartContractId, contractAddress);
    }
  }

  async handleReindexAll(smartContractId: number, contractAddress: string) {
    const cw721Contract = await CW721Contract.query()
      .withGraphJoined('smart_contract')
      .where('smart_contract.address', contractAddress)
      .select(['cw721_contract.id'])
      .first();
    // query
    const contractInfo = (
      await CW721Contract.getContractsInfo([contractAddress])
    )[0];
    const currentTokensOwner = await CW721Contract.getAllTokensOwner(
      contractAddress
    );
    const minUpdatedHeightOwner =
      _.min(
        currentTokensOwner.map((tokenOwner) => tokenOwner.last_updated_height)
      ) || 0;
    const maxUpdatedHeightOwner =
      _.max(
        currentTokensOwner.map((tokenOwner) => tokenOwner.last_updated_height)
      ) || 0;
    if (cw721Contract) {
      await CW721Activity.query()
        .delete()
        .where('cw721_contract_id', cw721Contract.id);
      await CW721ContractStats.query()
        .delete()
        .where('cw721_contract_id', cw721Contract.id);
      await CW721Token.query()
        .delete()
        .where('cw721_contract_id', cw721Contract.id);
      await CW721Contract.query().deleteById(cw721Contract.id);
    }
    await CW721Contract.query().insertGraph({
      ...CW721Contract.fromJson({
        contract_id: smartContractId,
        symbol: contractInfo?.symbol,
        minter: contractInfo?.minter,
        name: contractInfo?.name,
        track: true,
      }),
      tokens: currentTokensOwner.map((tokenOwner) =>
        CW721Token.fromJson({
          token_id: tokenOwner.token_id,
          media_info: null,
          owner: tokenOwner.owner,
          last_updated_height: tokenOwner.last_updated_height,
          burned: false,
        })
      ),
    });
    // handle from minUpdatedHeightOwner to blockHeight
    await this.broker.call(
      SERVICE.V1.Cw721.HandleRangeBlockMissingContract.path,
      {
        smartContractId,
        startBlock: minUpdatedHeightOwner,
        endBlock: maxUpdatedHeightOwner,
      } satisfies IContextReindexingServiceHistory
    );
    // insert histories
    await this.createJob(
      BULL_JOB_NAME.REINDEX_CW721_HISTORY,
      BULL_JOB_NAME.REINDEX_CW721_HISTORY,
      {
        smartContractId,
        startBlock: config.crawlBlock.startBlock,
        endBlock: maxUpdatedHeightOwner,
        prevId: 0,
        contractAddress,
      } satisfies ICw721ReindexingHistoryParams,
      {
        removeOnComplete: true,
      }
    );
  }

  async handleReindexHistory(smartContractId: number, contractAddress: string) {
    const cw721Contract = await CW721Contract.query()
      .withGraphJoined('smart_contract')
      .where('smart_contract.address', contractAddress)
      .select(['cw721_contract.id'])
      .first()
      .throwIfNotFound();
    const currentHeight = (await CW721Activity.query().max('height'))[0].max;
    await CW721Activity.query()
      .delete()
      .where('cw721_contract_id', cw721Contract.id)
      .andWhere('height', '<=', currentHeight);
    // insert histories
    await this.createJob(
      BULL_JOB_NAME.REINDEX_CW721_HISTORY,
      BULL_JOB_NAME.REINDEX_CW721_HISTORY,
      {
        smartContractId,
        startBlock: config.crawlBlock.startBlock,
        endBlock: currentHeight,
        prevId: 0,
        contractAddress,
      } satisfies ICw721ReindexingHistoryParams,
      {
        removeOnComplete: true,
      }
    );
  }

  @Action({
    name: SERVICE.V1.CW721ReindexingService.Reindexing.key,
    params: {
      contractAddresses: {
        type: 'array',
        items: 'string',
        optional: false,
      },
      type: {
        type: 'string',
        optional: false,
      },
    },
  })
  public async reindexing(ctx: Context<IAddressParam>) {
    const { contractAddresses, type } = ctx.params;
    const smartContracts = await SmartContract.query()
      .withGraphJoined('code')
      .whereIn('address', contractAddresses);
    // eslint-disable-next-line no-restricted-syntax
    for (const smartContract of smartContracts) {
      if (smartContract.code.type === 'CW721') {
        // eslint-disable-next-line no-await-in-loop
        await this.createJob(
          BULL_JOB_NAME.REINDEX_CW721_CONTRACT,
          BULL_JOB_NAME.REINDEX_CW721_CONTRACT,
          {
            contractAddress: smartContract.address,
            smartContractId: smartContract.id,
            type,
          } satisfies ICw721ReindexingServiceParams,
          {
            jobId: smartContract.address,
          }
        );
      }
    }
  }

  async _start(): Promise<void> {
    await this.broker.waitForServices(SERVICE.V1.Cw721.name);
    return super._start();
  }
}
