import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  IContextCrawlMissingContractHistory,
  SERVICE,
  getHttpBatchClient,
} from '../../common';
import { BlockCheckpoint, SmartContract } from '../../models';
import CW721Contract from '../../models/cw721_contract';
import CW721Token from '../../models/cw721_token';

export interface IAddressParam {
  contractAddress: string;
}

@Service({
  name: SERVICE.V1.CW721CrawlMissingContract.key,
  version: 1,
})
export default class Cw721MissingContractService extends BullableService {
  _httpBatchClient!: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @Action({
    name: SERVICE.V1.CW721CrawlMissingContract.CrawlMissingContract.key,
    params: {
      contractAddress: 'string',
    },
  })
  public async CrawlMissingContract(ctx: Context<IAddressParam>) {
    const smartContract = await SmartContract.query()
      .withGraphJoined('code')
      .where('address', ctx.params.contractAddress)
      .first()
      .throwIfNotFound();
    const cw721BlockCheckpoint = (
      await BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.HANDLE_CW721_TRANSACTION)
        .throwIfNotFound()
    ).height;
    // check whether contract is CW721 type -> throw error to user
    if (smartContract.code.type === 'CW721') {
      const cw721Contract = await CW721Contract.query()
        .withGraphJoined('smart_contract')
        .where('smart_contract.address', ctx.params.contractAddress)
        .select(['cw721_contract.id'])
        .first();
      // query
      const contractInfo = (
        await CW721Contract.getContractsInfo([ctx.params.contractAddress])
      )[0];
      const currentTokensOwner = await CW721Contract.getAllTokensOwner(
        ctx.params.contractAddress
      );
      const minUpdatedHeightOwner =
        currentTokensOwner.length > 0
          ? Math.min(
              ...currentTokensOwner.map(
                (tokenOwner) => tokenOwner.last_updated_height
              )
            )
          : 0;
      const maxUpdatedHeightOwner =
        currentTokensOwner.length > 0
          ? Math.max(
              ...currentTokensOwner.map(
                (tokenOwner) => tokenOwner.last_updated_height
              )
            )
          : 0;
      if (maxUpdatedHeightOwner - cw721BlockCheckpoint < 2000000) {
        CW721Token.softDelete = false;
        await CW721Contract.query().upsertGraph({
          ...CW721Contract.fromJson({
            id: cw721Contract?.id,
            contract_id: smartContract.id,
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
        CW721Token.softDelete = true;
        // handle from minUpdatedHeightOwner to blockHeight
        await this.broker.call(
          SERVICE.V1.Cw721.HandleRangeBlockMissingContract.path,
          {
            smartContractId: smartContract.id,
            startBlock: minUpdatedHeightOwner,
            endBlock: maxUpdatedHeightOwner,
          } satisfies IContextCrawlMissingContractHistory
        );
        // insert histories
        await this.broker.call(
          SERVICE.V1.Cw721.CrawlMissingContractHistory.path,
          {
            smartContractId: smartContract.id,
            startBlock: config.crawlBlock.startBlock,
            endBlock: maxUpdatedHeightOwner,
          } satisfies IContextCrawlMissingContractHistory
        );
      } else {
        throw new Error('CW721 service sync too slowly');
      }
    } else {
      throw new Error(
        `Smart contract ${ctx.params.contractAddress} is not CW721 type`
      );
    }
  }

  async _start(): Promise<void> {
    await this.broker.waitForServices(SERVICE.V1.Cw721.name);
    return super._start();
  }
}
