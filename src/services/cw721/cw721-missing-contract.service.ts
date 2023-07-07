import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import CW721Activity from '../../models/cw721_tx';
import CW721ContractStats from '../../models/cw721_stats';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  IContextCrawlMissingContractHistory,
  SERVICE,
  getHttpBatchClient,
} from '../../common';
import { SmartContract } from '../../models';
import CW721Contract from '../../models/cw721_contract';
import CW721Token from '../../models/cw721_token';

export interface IAddressParam {
  contractAddress: string;
}

interface ICw721CrawlMissingContractParams {
  contractAddress: string;
  smartContractId: number;
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

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_CW721_MISSING_CONTRACT,
    jobName: BULL_JOB_NAME.CRAWL_CW721_MISSING_CONTRACT,
  })
  async jobHandler(_payload: ICw721CrawlMissingContractParams): Promise<void> {
    const { smartContractId, contractAddress } = _payload;
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
      } satisfies IContextCrawlMissingContractHistory
    );
    // insert histories
    await this.broker.call(SERVICE.V1.Cw721.CrawlMissingContractHistory.path, {
      smartContractId,
      startBlock: config.crawlBlock.startBlock,
      endBlock: maxUpdatedHeightOwner,
    } satisfies IContextCrawlMissingContractHistory);
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
    // check whether contract is CW721 type -> throw error to user
    if (smartContract.code.type === 'CW721') {
      await this.createJob(
        BULL_JOB_NAME.CRAWL_CW721_MISSING_CONTRACT,
        BULL_JOB_NAME.CRAWL_CW721_MISSING_CONTRACT,
        {
          contractAddress: ctx.params.contractAddress,
          smartContractId: smartContract.id,
        } satisfies ICw721CrawlMissingContractParams,
        {
          removeOnComplete: true,
        }
      );
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
