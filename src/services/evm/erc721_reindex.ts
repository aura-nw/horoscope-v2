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
    await Erc721Activity.query()
      .delete()
      .where('erc721_contract_address', address);
    await Erc721Token.query()
      .delete()
      .where('erc721_contract_address', address);
    await Erc721Contract.query().delete().where('address', address);
    const contract = getContract({
      address,
      abi: Erc721Contract.ABI,
      client: this.viemClient,
    });
    const contractInfo = await Promise.all([
      contract.read.name().catch(() => Promise.resolve(undefined)),
      contract.read.symbol().catch(() => Promise.resolve(undefined)),
    ]);
    console.log(contractInfo);
  }

  // async getCurrentTokens(address: `0x${string}`) {
  //   const contract = getContract({
  //     address,
  //     abi: Erc721Contract.ABI,
  //     client: this.viemClient,
  //   });

  // }
}
