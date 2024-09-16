import Moleculer from 'moleculer';
import { PublicClient, getContract } from 'viem';
import { Dictionary } from 'lodash';
import knex from '../../common/utils/db_connection';
import {
  Erc721Activity,
  Erc721Contract,
  Erc721HolderStatistic,
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
          // Erc721 Enumerable InterfaceId
          .supportsInterface(['0x780e9d63'])
          .catch(() => Promise.resolve(false))
      )
    );
    return erc721ContractAddrs.filter((_, index) => isErc721Enumerable[index]);
  }

  /**
   * @description reindex erc721 contract
   * @requires filterReindex
   * @param addresses Contracts address that you want to reindex
   * @steps
   * - clean database: ERC721 Contract, ERC721 Activity, ERC721 Holder
   * - get current status of those erc721 contracts: contracts info, tokens and holders
   * - reinsert to database
   */
  async reindex(address: `0x${string}`) {
    // stop tracking => if start reindexing, track will be false (although error when reindex)
    await Erc721Contract.query()
      .patch({ track: false })
      .where('address', address);
    // reindex
    await knex.transaction(async (trx) => {
      const erc721Contract = await Erc721Contract.query()
        .transacting(trx)
        .joinRelated('evm_smart_contract')
        .where('erc721_contract.address', address)
        .select(
          'evm_smart_contract.id as evm_smart_contract_id',
          'erc721_contract.id'
        )
        .first()
        .throwIfNotFound();
      await Erc721HolderStatistic.query()
        .delete()
        .where('erc721_contract_address', address)
        .transacting(trx);
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
      const [blockHeight, ...contractInfo] = await Promise.all([
        this.viemClient.getBlockNumber(),
        contract.read.name().catch(() => Promise.resolve(undefined)),
        contract.read.symbol().catch(() => Promise.resolve(undefined)),
      ]);
      const [tokens, height] = await this.getCurrentTokens(address);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const newErc721Contract: Erc721Contract[] = await Erc721Contract.query()
        .insert(
          Erc721Contract.fromJson({
            evm_smart_contract_id: erc721Contract.evm_smart_contract_id,
            address,
            symbol: contractInfo[1],
            name: contractInfo[0],
            track: true,
            last_updated_height: Number(blockHeight),
            total_supply: tokens.length,
          })
        )
        .transacting(trx);
      const activities = await Erc721Handler.getErc721Activities(
        0,
        height,
        this.logger,
        [address],
        trx
      );
      const erc721HolderStats: Dictionary<Erc721HolderStatistic> =
        tokens.reduce((acc: Dictionary<Erc721HolderStatistic>, curr) => {
          const count = acc[curr.owner] ? acc[curr.owner].count + 1 : 1;
          acc[curr.owner] = Erc721HolderStatistic.fromJson({
            erc721_contract_address: address,
            owner: curr.owner,
            count,
          });
          return acc;
        }, {});
      await Erc721Handler.updateErc721(
        newErc721Contract,
        activities,
        tokens,
        Object.values(erc721HolderStats),
        trx
      );
    });
    const erc721Stats = await Erc721Handler.calErc721Stats([address]);
    if (erc721Stats.length > 0) {
      // Upsert erc721 stats
      await Erc721Stats.query()
        .insert(
          erc721Stats.map((e) =>
            Erc721Stats.fromJson({
              total_activity: e.total_activity,
              transfer_24h: e.transfer_24h,
              erc721_contract_id: e.erc721_contract_id,
            })
          )
        )
        .onConflict('erc721_contract_id')
        .merge()
        .returning('id');
    }
  }

  async getCurrentTokens(
    address: `0x${string}`
  ): Promise<[Erc721Token[], number]> {
    const contract = getContract({
      address,
      abi: Erc721Contract.ABI,
      client: this.viemClient,
    });
    const totalSupply = (await contract.read
      .totalSupply()
      .catch(() => Promise.resolve(BigInt(0)))) as bigint;
    const tokensId = (await Promise.all(
      Array.from(Array(Number(totalSupply)).keys()).map((i) =>
        contract.read.tokenByIndex([i])
      )
    )) as bigint[];
    const [height, ...owners]: [bigint, ...string[]] = await Promise.all([
      this.viemClient.getBlockNumber(),
      ...tokensId.map(
        (tokenId) =>
          contract.read
            .ownerOf([tokenId])
            .catch(() => Promise.resolve('')) as Promise<string>
      ),
    ]);
    return [
      tokensId.map((tokenId, index) =>
        Erc721Token.fromJson({
          token_id: tokenId.toString(),
          owner: owners[index].toLowerCase(),
          erc721_contract_address: address,
          last_updated_height: Number(height),
        })
      ),
      Number(height),
    ];
  }
}
