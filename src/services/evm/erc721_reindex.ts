import Moleculer from 'moleculer';
import { PublicClient, getContract } from 'viem';
import _ from 'lodash';
import knex from '../../common/utils/db_connection';
import {
  Erc721Activity,
  Erc721Contract,
  Erc721Stats,
  Erc721Token,
} from '../../models';
import { Erc721Handler } from './erc721_handler';

export class Erc721Reindexer {
  viemClient: PublicClient;

  logger!: Moleculer.LoggerInstance;

  constructor(viemClient: PublicClient, logger: Moleculer.LoggerInstance) {
    this.viemClient = viemClient;
    this.logger = logger;
  }

  /**
   * @description filter reindexable erc721 contracts
   * @param addresses Contracts address that you want to filter
   * @steps
   * - check type
   * - check ERC721Enumerable implementation
   */
  async filterReindex(addresses: `0x${string}`[]) {
    const erc721ContractAddrs = (
      await Erc721Contract.query().whereIn('address', addresses)
    ).map((e) => e.address) as `0x${string}`[];
    const erc721Contracts = erc721ContractAddrs.map((address) =>
      getContract({
        address,
        abi: Erc721Contract.ABI,
        client: this.viemClient,
      })
    );
    const isErc721Enumerable = await Promise.all(
      erc721Contracts.map((e) =>
        e.read
          .supportsInterface([0x780e9d63])
          .catch(() => Promise.resolve(false))
      )
    );
    return addresses.filter((_, index) => isErc721Enumerable[index]);
  }

  /**
   * @description reindex erc721 contract
   * @param addresses Contracts address that you want to reindex
   * @steps
   * - clean database: ERC721 Contract, ERC721 Activity, ERC721 Holder
   * - get current status of those erc721 contracts: contracts info, tokens and holders
   * - reinsert to database
   */
  async reindex(addresses: `0x${string}`[]) {
    await knex.transaction(async (trx) => {
      const erc721Contracts = _.keyBy(
        await Erc721Contract.query()
          .transacting(trx)
          .joinRelated('evm_smart_contract')
          .whereIn('erc721_contract.address', addresses)
          .select(
            'evm_smart_contract.id as evm_smart_contract_id',
            'erc721_contract.id',
            'erc721_contract.address'
          ),
        'address'
      );
      await Erc721Stats.query()
        .delete()
        .whereIn(
          'erc721_contract_id',
          Object.values(erc721Contracts).map((e) => e.id)
        )
        .transacting(trx);
      await Erc721Activity.query()
        .delete()
        .whereIn('erc721_contract_address', addresses)
        .transacting(trx);
      await Erc721Token.query()
        .delete()
        .whereIn('erc721_contract_address', addresses)
        .transacting(trx);
      await Erc721Contract.query()
        .delete()
        .whereIn('address', addresses)
        .transacting(trx);
      const contracts = addresses.map((address) =>
        getContract({
          address,
          abi: Erc721Contract.ABI,
          client: this.viemClient,
        })
      );
      const [heightContract, ...contractsInfo] = await Promise.all([
        this.viemClient.getBlockNumber(),
        ...contracts.flatMap((contract) => [
          contract.read.name().catch(() => Promise.resolve(undefined)),
          contract.read.symbol().catch(() => Promise.resolve(undefined)),
        ]),
      ]);
      await Erc721Contract.query()
        .insert(
          addresses.map((address, index) =>
            Erc721Contract.fromJson({
              evm_smart_contract_id:
                erc721Contracts[address].evm_smart_contract_id,
              address,
              symbol: contractsInfo[index * 2 + 1],
              name: contractsInfo[index * 2],
              track: true,
              last_updated_height: Number(heightContract),
            })
          )
        )
        .transacting(trx);
      const [tokens, height] = await this.getCurrentTokens(addresses);
      const activities = await Erc721Handler.getErc721Activities(
        0,
        height,
        trx,
        this.logger,
        addresses
      );
      await Erc721Handler.updateErc721(activities, tokens, trx);
    });
  }

  async getCurrentTokens(
    addresses: `0x${string}`[]
  ): Promise<[Erc721Token[], number]> {
    const contracts = addresses.map((address) =>
      getContract({
        address,
        abi: Erc721Contract.ABI,
        client: this.viemClient,
      })
    );
    const totalSupplyResults = (await Promise.all(
      contracts.map((contract) => contract.read.totalSupply())
    )) as bigint[];
    const allTokensId = (await Promise.all(
      contracts.flatMap((contract, index) =>
        Array.from(Array(Number(totalSupplyResults[index])).keys()).map((i) =>
          contract.read.tokenByIndex([i])
        )
      )
    )) as bigint[];
    const [height, ...allOwners] = (await Promise.all([
      this.viemClient.getBlockNumber(),
      ...contracts.flatMap((contract, index) => {
        const totalSupply = Number(totalSupplyResults[index]);
        const offset = Array.from(Array(index).keys()).reduce(
          (acc: number, curr: number) => acc + Number(totalSupplyResults[curr]),
          0
        );
        const tokensId = allTokensId.slice(offset, offset + totalSupply);
        return tokensId.map((tokenId) => contract.read.ownerOf([tokenId]));
      }),
    ])) as (string | bigint)[];
    return [
      addresses.flatMap((address, index) => {
        const totalSupply = Number(totalSupplyResults[index]);
        const offset = Array.from(Array(index).keys()).reduce(
          (acc: number, curr: number) => acc + Number(totalSupplyResults[curr]),
          0
        );
        const tokensId = allTokensId.slice(offset, offset + totalSupply);
        const owners = allOwners.slice(offset, offset + totalSupply);
        return tokensId.map((tokenId, index) =>
          Erc721Token.fromJson({
            token_id: tokenId.toString(),
            owner: owners[index],
            erc721_contract_address: address,
            last_updated_height: Number(height),
          })
        );
      }),
      Number(height),
    ];
  }
}
