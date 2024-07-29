import Moleculer from 'moleculer';
import { getContract, PublicClient } from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';
import { AccountBalance, Erc20Activity, Erc20Contract } from '../../models';
import { Erc20Handler } from './erc20_handler';
import { convertEthAddressToBech32Address } from './utils';

export class Erc20Reindexer {
  viemClient: PublicClient;

  logger!: Moleculer.LoggerInstance;

  constructor(viemClient: PublicClient, logger: Moleculer.LoggerInstance) {
    this.viemClient = viemClient;
    this.logger = logger;
  }

  /**
   * @description reindex erc20 contract
   * @param addresses Contracts address that you want to reindex
   * @steps
   * - clean database: erc20 AccountBalance
   * - re-compute erc20 AccountBalance
   */
  async reindex(address: `0x${string}`) {
    // stop tracking => if start reindexing, track will be false (although error when reindex)
    await Erc20Contract.query()
      .patch({ track: false })
      .where('address', address);
    // reindex
    await knex.transaction(async (trx) => {
      const erc20Contract = await Erc20Contract.query()
        .transacting(trx)
        .joinRelated('evm_smart_contract')
        .where('erc20_contract.address', address)
        .select('evm_smart_contract.id as evm_smart_contract_id')
        .first()
        .throwIfNotFound();
      await Erc20Activity.query()
        .delete()
        .where('erc20_contract_address', address)
        .transacting(trx);
      await AccountBalance.query()
        .delete()
        .where('denom', address)
        .transacting(trx);
      await Erc20Contract.query()
        .delete()
        .where('address', address)
        .transacting(trx);
      const contract = getContract({
        address,
        abi: Erc20Contract.ABI,
        client: this.viemClient,
      });
      const [blockHeight, ...contractInfo] = await Promise.all([
        this.viemClient.getBlockNumber(),
        contract.read.name().catch(() => Promise.resolve(undefined)),
        contract.read.symbol().catch(() => Promise.resolve(undefined)),
        contract.read.decimals().catch(() => Promise.resolve(undefined)),
      ]);
      await Erc20Contract.query()
        .insert(
          Erc20Contract.fromJson({
            evm_smart_contract_id: erc20Contract.evm_smart_contract_id,
            address,
            symbol: contractInfo[1],
            name: contractInfo[0],
            total_supply: '0',
            decimal: contractInfo[2],
            track: true,
            last_updated_height: Number(blockHeight),
          })
        )
        .transacting(trx);
      const erc20Activities = await Erc20Handler.buildErc20Activities(
        0,
        Number(blockHeight),
        trx,
        this.logger,
        [address]
      );
      if (erc20Activities.length > 0) {
        await knex
          .batchInsert(
            'erc20_activity',
            erc20Activities,
            config.erc20.chunkSizeInsert
          )
          .transacting(trx);
      }
      const erc20ActivitiesInDb = await Erc20Handler.getErc20Activities(
        0,
        Number(blockHeight),
        trx,
        [address]
      );
      // get missing Account
      const missingAccountsAddress = Array.from(
        new Set(
          [
            ...erc20ActivitiesInDb
              .filter((e) => !e.from_account_id)
              .map((e) => e.from),
            ...erc20ActivitiesInDb
              .filter((e) => !e.to_account_id)
              .map((e) => e.to),
          ].map((e) =>
            convertEthAddressToBech32Address(config.networkPrefixAddress, e)
          ) as string[]
        )
      );
      if (missingAccountsAddress.length > 0) {
        throw new Error(
          `Missing accounts ${missingAccountsAddress}. You should reindex them`
        );
      }
      await Erc20Handler.updateErc20AccountsBalance(erc20ActivitiesInDb, trx);
    });
  }
}
