import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { Context, ServiceBroker } from 'moleculer';
import { SmartContract } from 'src/models';
import CW721Token from 'src/models/cw721_token';
import CW721Contract from '../../models/cw721_contract';
import { SERVICE, getHttpBatchClient } from '../../common';
import BullableService from '../../base/bullable.service';

export interface IAddressParam {
  address: string;
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
    const smartContract = await SmartContract.query()
      .withGraphJoined('code')
      .where('address', ctx.params.address)
      .first()
      .throwIfNotFound();
    const cw721Contract = await CW721Contract.query()
      .withGraphJoined('smart_contract')
      .where('smart_contract.address', ctx.params.address)
      .first();
    if (smartContract.code.type === 'CW721') {
      if (!cw721Contract) {
        const contractInfo = (
          await CW721Contract.getContractsInfo(
            [ctx.params.address],
            this._httpBatchClient,
            this.logger
          )
        )[0];
        const momentTokensOwner = await CW721Contract.getTokensOwner(
          ctx.params.address,
          this._httpBatchClient
        );
        await CW721Contract.query().insertGraph({
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
        });
      }
    } else {
      throw new Error(`Smart contract ${ctx.params.address} is not CW721 type`);
    }
    // check
  }

  async _start(): Promise<void> {
    return super._start();
  }
}
