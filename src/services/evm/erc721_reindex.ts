import knex from 'src/common/utils/db_connection';
import { PublicClient, getContract } from 'viem';
import { Erc721Activity, Erc721Contract, Erc721Token } from '../../models';

export class Erc721Reindexer {
  viemClient: PublicClient;

  constructor(viemClient: PublicClient) {
    this.viemClient = viemClient;
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
      ]);
      await Erc721Contract.query()
        .insert(
          Erc721Contract.fromJson({
            evm_smart_contract_id: 0,
            address,
            symbol: contractInfo[1],
            name: contractInfo[0],
            track: true,
            last_updated_height: 0,
          })
        )
        .transacting(trx);
    });
  }

  async getCurrentTokens(address: `0x${string}`) {
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
    return tokensId.map((tokenId, index) =>
      Erc721Token.fromJson({
        token_id: tokenId.toString(),
        owner: owners[index],
        erc721_contract_address: address,
        last_updated_height: Number(height),
      })
    );
  }
}
