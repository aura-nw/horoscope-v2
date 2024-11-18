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
      const newErc721Contract: Erc721Contract = await Erc721Contract.query()
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
      const erc721HolderStats: Dictionary<Erc721HolderStatistic> = {};
      tokens.forEach((token) => {
        const { owner } = token;
        const currentCount = erc721HolderStats[owner]?.count || '0';
        const newCount = (BigInt(currentCount) + BigInt(1)).toString();
        erc721HolderStats[owner] = Erc721HolderStatistic.fromJson({
          erc721_contract_address: address,
          owner,
          count: newCount,
        });
      });
      await Erc721Handler.updateErc721(
        [newErc721Contract],
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
    await Erc721Contract.query()
      .patch({ track: true })
      .where('address', address);
    this.logger.info('set track to true');
  }

  async getCurrentTokens(
    address: `0x${string}`
  ): Promise<[Erc721Token[], number]> {
    const contract = getContract({
      address,
      abi: Erc721Contract.ABI,
      client: this.viemClient,
    });
    function chunkArray(array: any, chunkSize: number) {
      const result = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        result.push(array.slice(i, i + chunkSize));
      }
      return result;
    }
    const totalSupply = (await contract.read
      .totalSupply()
      .catch(() => Promise.resolve(BigInt(0)))) as bigint;
    const chunkedTokenIds = chunkArray(
      [...Array(Number(totalSupply)).keys()],
      500
    );
    let i = 0;
    const tokensId = [];
    while (i < chunkedTokenIds.length) {
      this.logger.info(`get id: ${i}/${chunkedTokenIds.length}`);
      // eslint-disable-next-line no-await-in-loop
      const res = await Promise.all(
        chunkedTokenIds[i].map((index: any) =>
          contract.read.tokenByIndex([index])
        )
      );
      tokensId.push(...res);
      i += 1;
    }

    // const tokensId = (await Promise.all(
    //   Array.from(Array(Number(totalSupply)).keys()).map((i) =>
    //     contract.read.tokenByIndex([i])
    //   )
    // )) as bigint[];
    // const tokensId = [...Array(Number(totalSupply)).keys()];

    const chunkedArray = chunkArray(tokensId, 500);
    i = 0;
    const erc721Tokens: Erc721Token[] = [];
    let lastHeight = BigInt(0);
    while (i < chunkedArray.length) {
      this.logger.info(`Handle ${i}/${chunkedArray.length}`);
      // eslint-disable-next-line no-await-in-loop
      const [height, ...owners]: [bigint, ...string[]] = await Promise.all([
        this.viemClient.getBlockNumber(),
        ...chunkedArray[i].map(
          (tokenId: number) =>
            contract.read
              .ownerOf([tokenId])
              .catch(() => Promise.resolve('')) as Promise<string>
        ),
      ]);
      lastHeight = height;
      erc721Tokens.push(
        ...chunkedArray[i].map((tokenId: number, index: number) =>
          Erc721Token.fromJson({
            token_id: tokenId.toString(),
            owner: owners[index].toLowerCase(),
            erc721_contract_address: address,
            last_updated_height: Number(height),
          })
        )
      );
      i += 1;
    }
    this.logger.info('Handle done list token');

    return [erc721Tokens, Number(lastHeight)];
  }
}
