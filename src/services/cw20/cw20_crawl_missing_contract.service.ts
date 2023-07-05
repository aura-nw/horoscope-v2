import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService from '../../base/bullable.service';
import { SERVICE } from '../../common';
import { CW20Holder, Cw20Contract, SmartContract } from '../../models';
import CW721Token from '../../models/cw721_token';
import { IContextCrawlMissingContractHistory } from './cw20.service';

export interface IAddressParam {
  contractAddress: string;
}

@Service({
  name: SERVICE.V1.Cw20CrawlMissingContract.key,
  version: 1,
})
export default class Cw20CrawlMissingContract extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @Action({
    name: SERVICE.V1.Cw20CrawlMissingContract.CrawlMissingContract.key,
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
    if (smartContract.code.type === 'CW20') {
      const cw20Contract = await Cw20Contract.query()
        .withGraphJoined('smart_contract')
        .where('smart_contract.address', ctx.params.contractAddress)
        .select(['cw20_contract.id'])
        .first();
      // query
      const contractInfo = (
        await Cw20Contract.getContractsInfo([ctx.params.contractAddress])
      )[0];
      const currentHolders = await Cw20Contract.getInstantiateBalances(
        ctx.params.contractAddress
      );
      const minUpdatedHeightOwner =
        currentHolders.length > 0
          ? Math.min(...currentHolders.map((holder) => holder.event_height))
          : 0;
      const maxUpdatedHeightOwner =
        currentHolders.length > 0
          ? Math.max(...currentHolders.map((holder) => holder.event_height))
          : 0;
      CW20Holder.softDelete = false;
      await Cw20Contract.query().upsertGraph({
        ...Cw20Contract.fromJson({
          id: cw20Contract?.id,
          smart_contract_id: smartContract.id,
          symbol: contractInfo?.symbol,
          minter: contractInfo?.minter,
          marketing_info: contractInfo?.marketing_info,
          name: contractInfo?.name,
          total_supply: currentHolders.reduce(
            (acc: string, curr: { address: string; amount: string }) =>
              (BigInt(acc) + BigInt(curr.amount)).toString(),
            '0'
          ),
          track: true,
          decimal: contractInfo?.decimal,
          last_updated_height: maxUpdatedHeightOwner,
        }),
        holders: currentHolders.map((e) => ({
          address: e.address,
          amount: e.amount,
          last_updated_height: e.event_height,
        })),
      });
      CW721Token.softDelete = true;
      // handle from minUpdatedHeightOwner to blockHeight
      await this.broker.call(
        SERVICE.V1.Cw20.HandleRangeBlockMissingContract.path,
        {
          smartContractId: smartContract.id,
          startBlock: minUpdatedHeightOwner,
          endBlock: maxUpdatedHeightOwner,
        } satisfies IContextCrawlMissingContractHistory
      );
      // insert histories
      await this.broker.call(SERVICE.V1.Cw20.CrawlMissingContractHistory.path, {
        smartContractId: smartContract.id,
        startBlock: config.crawlBlock.startBlock,
        endBlock: maxUpdatedHeightOwner,
      } satisfies IContextCrawlMissingContractHistory);
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
