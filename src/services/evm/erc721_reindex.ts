import Moleculer from 'moleculer';
import { PublicClient, getContract } from 'viem';
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
   * @param address Contract address that you want to reindex
   * @steps
   * - clean database: ERC721 Contract, ERC721 Activity, ERC721 Holder
   * - get current status of those erc721 contracts: contracts info, tokens and holders
   * - reinsert to database
   */
  async reindex(address: `0x${string}`) {
    await knex.transaction(async (trx) => {
      const erc721Contract = await Erc721Contract.query()
        .transacting(trx)
        .joinRelated('evm_smart_contract')
        .where('erc721_contract.address', address)
        .first()
        .select(
          'evm_smart_contract.id as evm_smart_contract_id',
          'erc721_contract.id'
        )
        .throwIfNotFound();
      await Erc721Stats.query()
        .delete()
        .where('erc721_contract_id', erc721Contract.id)
        .transacting(trx);
      await Erc721Activity.query()
        .delete()
        .where('erc721_contract_address', address)
        .transacting(trx);
      await Erc721Token.query()
        .delete()
        .where('erc721_contract_address', address)
        .transacting(trx);
      await Erc721Contract.query()
        .delete()
        .where('address', address)
        .transacting(trx);
      const contract = getContract({
        address,
        abi: Erc721Contract.ABI,
        client: this.viemClient,
      });
      const contractInfo = await Promise.all([
        contract.read.name().catch(() => Promise.resolve(undefined)),
        contract.read.symbol().catch(() => Promise.resolve(undefined)),
        this.viemClient.getBlockNumber(),
      ]);
      await Erc721Contract.query()
        .insert(
          Erc721Contract.fromJson({
            evm_smart_contract_id: erc721Contract.evm_smart_contract_id,
            address,
            symbol: contractInfo[1],
            name: contractInfo[0],
            track: true,
            last_updated_height: Number(contractInfo[2]),
          })
        )
        .transacting(trx);
      const [tokens, height] = await this.getCurrentTokens(address);
      const activities = await Erc721Handler.getErc721Activities(
        0,
        height,
        trx,
        this.logger,
        address
      );
      await Erc721Handler.updateErc721(activities, tokens, trx);
    });
  }

  async getCurrentTokens(
    address: `0x${string}`
  ): Promise<[Erc721Token[], number]> {
    const contract = getContract({
      address,
      abi: Erc721Contract.ABI,
      client: this.viemClient,
    });
    const totalSupply = (await contract.read.totalSupply()) as bigint;
    const tokensId = (await Promise.all(
      Array.from(Array(Number(totalSupply)).keys()).map((i) =>
        contract.read.tokenByIndex([i])
      )
    )) as bigint[];
    const [height, ...owners] = (await Promise.all([
      this.viemClient.getBlockNumber(),
      ...tokensId.map((tokenId) => contract.read.ownerOf([tokenId])),
    ])) as (string | bigint)[];
    return [
      tokensId.map((tokenId, index) =>
        Erc721Token.fromJson({
          token_id: tokenId.toString(),
          owner: owners[index],
          erc721_contract_address: address,
          last_updated_height: Number(height),
        })
      ),
      Number(height),
    ];
  }
}
