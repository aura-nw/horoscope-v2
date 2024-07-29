/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Knex } from 'knex';
import _, { Dictionary } from 'lodash';
import { Context } from 'moleculer';
import { PublicClient } from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import '../../../fetch-polyfill.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import knex from '../../common/utils/db_connection';
import { getViemClient } from '../../common/utils/etherjs_client';
import {
  Account,
  AccountBalance,
  BlockCheckpoint,
  EvmInternalTransaction,
  EVMTransaction,
} from '../../models';
import { BULL_JOB_NAME, SERVICE, ZERO_ADDRESS } from './constant';

@Service({
  name: SERVICE.V1.CrawlEvmAccount.key,
  version: 1,
})
export default class CrawlEvmAccountService extends BullableService {
  viemClient!: PublicClient;

  @Action({
    name: SERVICE.V1.CrawlEvmAccount.CrawlNewAccountApi.key,
    params: {
      addresses: 'string[]',
    },
  })
  public async actionCrawlNewAccountApi(ctx: Context<{ addresses: string[] }>) {
    const { addresses } = ctx.params;
    await knex.transaction(async (trx) => {
      if (addresses.length > 0) {
        await this.insertNewAccounts(
          addresses.map((address) =>
            Account.fromJson({
              address,
              evm_address: address,
              balances: [{ denom: config.networkDenom, amount: '0' }],
              spendable_balances: [{ denom: config.networkDenom, amount: '0' }],
              type: null,
              pubkey: {},
              account_number: 0,
              sequence: 0,
            })
          ),
          0,
          trx
        );
      }
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_EVM_ACCOUNT,
    jobName: BULL_JOB_NAME.CRAWL_EVM_ACCOUNT,
  })
  async crawlEvmAccount() {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_EVM_ACCOUNT,
        [BULL_JOB_NAME.CRAWL_EVM_TRANSACTION],
        config.crawlTransaction.key
      );
    this.logger.info(
      `Crawl evm_account from block ${startBlock} to ${endBlock}`
    );
    await knex.transaction(async (trx) => {
      const accountsAddress: Set<string> = new Set();
      const participants = await EVMTransaction.query()
        .where('height', '>', startBlock)
        .where('height', '<=', endBlock)
        .orderBy('height', 'asc')
        .select('from', 'to', 'contract_address as contractAddress')
        .transacting(trx);
      const participantsFromInternal = await EvmInternalTransaction.query()
        .transacting(trx)
        .joinRelated('evm_transaction')
        .where('evm_transaction.height', '>', startBlock)
        .andWhere('evm_transaction.height', '<=', endBlock)
        .andWhere('evm_internal_transaction.error', null)
        .select('evm_internal_transaction.from', 'evm_internal_transaction.to');
      participants.forEach((partcicipant) => {
        if (partcicipant.from !== ZERO_ADDRESS) {
          accountsAddress.add(partcicipant.from);
        }
        if (partcicipant.to && partcicipant.to !== ZERO_ADDRESS) {
          accountsAddress.add(partcicipant.to);
        }
        if (partcicipant.contractAddress) {
          accountsAddress.add(partcicipant.contractAddress);
        }
      });
      participantsFromInternal.forEach((participant) => {
        if (participant.from !== ZERO_ADDRESS) {
          accountsAddress.add(participant.from);
        }
        if (participant.to && participant.to !== ZERO_ADDRESS) {
          accountsAddress.add(participant.to);
        }
      });
      const [accountsInstances, height] = await this.getEvmAccountInstances(
        Array.from(accountsAddress)
      );
      if (accountsInstances.length > 0) {
        await this.insertNewAccounts(accountsInstances, height, trx);
      }
      if (blockCheckpoint) {
        blockCheckpoint.height = endBlock;
        await BlockCheckpoint.query()
          .insert(blockCheckpoint)
          .onConflict('job_name')
          .merge()
          .transacting(trx);
      }
    });
  }

  async insertNewAccounts(
    accountsInstances: Account[],
    lastUpdateHeight: number,
    trx: Knex.Transaction
  ) {
    const { batchSize } = config.crawlEvmAccount;
    for (
      let index = 0;
      index < accountsInstances.length / batchSize;
      index += 1
    ) {
      const batchAccounts = accountsInstances.slice(
        index * batchSize,
        (index + 1) * batchSize
      );
      const accounts: Dictionary<Account> = _.keyBy(
        await Account.query()
          .transacting(trx)
          .insert(batchAccounts)
          .onConflict(['address'])
          .merge(),
        'address'
      );
      await AccountBalance.query()
        .insert(
          batchAccounts.map((e) =>
            AccountBalance.fromJson({
              denom: config.networkDenom,
              amount: e.balances[0].amount,
              last_updated_height: lastUpdateHeight,
              account_id: accounts[e.address].id,
              type: AccountBalance.TYPE.NATIVE,
            })
          )
        )
        .onConflict(['account_id', 'denom'])
        .merge()
        .transacting(trx);
    }
  }

  async getEvmAccountInstances(
    participants: string[]
  ): Promise<[Account[], number]> {
    const [height, ...results] = await Promise.all([
      this.viemClient.getBlockNumber(),
      ...participants.map((addr) =>
        this.viemClient.getBalance({ address: addr as `0x${string}` })
      ),
      ...participants.map((addr) =>
        this.viemClient.getTransactionCount({ address: addr as `0x${string}` })
      ),
    ]);
    const { length } = participants;
    return [
      participants.map((e, index) =>
        Account.fromJson({
          address: e,
          balances: [
            { denom: config.networkDenom, amount: results[index].toString() },
          ],
          spendable_balances: [
            { denom: config.networkDenom, amount: results[index].toString() },
          ],
          type: null,
          pubkey: {},
          account_number: 0,
          sequence: results[length + index],
          evm_address: e,
        })
      ),
      Number(height),
    ];
  }

  public async _start(): Promise<void> {
    this.viemClient = getViemClient();
    await this.createJob(
      BULL_JOB_NAME.CRAWL_EVM_ACCOUNT,
      BULL_JOB_NAME.CRAWL_EVM_ACCOUNT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlEvmAccount.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
