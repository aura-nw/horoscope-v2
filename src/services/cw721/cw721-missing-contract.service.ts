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
import knex from '../../common/utils/db_connection';
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
  private async CrawlMissingContract(ctx: Context<IAddressParam>) {
    await knex.transaction(async (trx) => {
      const smartContract = await SmartContract.query()
        .transacting(trx)
        .withGraphJoined('code')
        .where('address', ctx.params.contractAddress)
        .first()
        .throwIfNotFound();
      const cw721Contract = await CW721Contract.query()
        .transacting(trx)
        .withGraphJoined('smart_contract')
        .where('smart_contract.address', ctx.params.contractAddress)
        .first();
      const cw721BlockCheckpoint = (
        await BlockCheckpoint.query()
          .select('*')
          .findOne('job_name', BULL_JOB_NAME.HANDLE_CW721_TRANSACTION)
          .throwIfNotFound()
      ).height;
      // check whether contract is CW721 type -> throw error to user
      if (smartContract.code.type === 'CW721') {
        // if contract have been in cw721_contract DB -> skip
        if (!cw721Contract) {
          // query
          const contractInfo = (
            await CW721Contract.getContractsInfo([ctx.params.contractAddress])
          )[0];
          const momentTokensOwner = await CW721Contract.getTokensOwner(
            ctx.params.contractAddress
          );
          const minUpdatedHeightOwner =
            momentTokensOwner.length > 0
              ? Math.min(
                  ...momentTokensOwner.map(
                    (tokenOwner) => tokenOwner.last_updated_height
                  )
                )
              : 0;
          const maxUpdatedHeightOwner =
            momentTokensOwner.length > 0
              ? Math.max(
                  ...momentTokensOwner.map(
                    (tokenOwner) => tokenOwner.last_updated_height
                  )
                )
              : 0;
          if (maxUpdatedHeightOwner - cw721BlockCheckpoint < 2000000) {
            await CW721Contract.query()
              .transacting(trx)
              .insertGraph({
                ...CW721Contract.fromJson({
                  contract_id: smartContract.id,
                  symbol: contractInfo?.symbol,
                  minter: contractInfo?.minter,
                  name: contractInfo?.name,
                  track: true,
                }),
                tokens: momentTokensOwner.map((tokenOwner) =>
                  CW721Token.fromJson({
                    token_id: tokenOwner.token_id,
                    media_info: null,
                    owner: tokenOwner.owner,
                    last_updated_height: tokenOwner.last_updated_height,
                    burned: false,
                  })
                ),
              })
              .transacting(trx);
            await this.broker.call(
              SERVICE.V1.Cw721.CrawlMissingContractHistory.path,
              {
                smartContractId: smartContract.id,
                startBlock: config.crawlBlock.startBlock,
                endBlock: maxUpdatedHeightOwner,
                trx,
              } satisfies IContextCrawlMissingContractHistory
            );
            // handle from minUpdatedHeightOwner to blockHeight
            await this.broker.call(
              SERVICE.V1.Cw721.HandleRangeBlockMissingContract.path,
              {
                smartContractId: smartContract.id,
                startBlock: minUpdatedHeightOwner,
                endBlock: maxUpdatedHeightOwner,
                trx,
              } satisfies IContextCrawlMissingContractHistory
            );
          } else {
            throw new Error('CW721 service sync too slowly');
          }
        }
      } else {
        throw new Error(
          `Smart contract ${ctx.params.contractAddress} is not CW721 type`
        );
      }
    });
  }

  async _start(): Promise<void> {
    await this.broker.waitForServices(SERVICE.V1.Cw721.name);
    return super._start();
  }
}
