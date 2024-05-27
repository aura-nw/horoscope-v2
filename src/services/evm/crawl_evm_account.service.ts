import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import _, { Dictionary } from 'lodash';
import { PublicClient } from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import '../../../fetch-polyfill.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import knex from '../../common/utils/db_connection';
import EtherJsClient from '../../common/utils/etherjs_client';
import {
  Account,
  AccountBalance,
  BlockCheckpoint,
  EVMTransaction,
} from '../../models';
import { BULL_JOB_NAME, SERVICE, ZERO_ADDRESS } from './constant';

@Service({
  name: SERVICE.V1.CrawlEvmAccount.key,
  version: 1,
})
export default class CrawlEvmAccountService extends BullableService {
  viemClient!: PublicClient;

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
        .select('from', 'to')
        .transacting(trx);
      participants.forEach((partcicipant) => {
        if (partcicipant.from !== ZERO_ADDRESS) {
          accountsAddress.add(partcicipant.from);
        }
        if (partcicipant.to && partcicipant.to !== ZERO_ADDRESS) {
          accountsAddress.add(partcicipant.to);
        }
      });
      const [accountsInstances, height] = await this.getEvmAccountInstances(
        Array.from(accountsAddress)
      );
      if (accountsInstances.length > 0) {
        const accounts: Dictionary<Account> = _.keyBy(
          await Account.query()
            .transacting(trx)
            .insert(accountsInstances)
            .onConflict(['address'])
            .merge(),
          'address'
        );
        await AccountBalance.query()
          .insert(
            accountsInstances.map((e) =>
              AccountBalance.fromJson({
                denom: config.networkDenom,
                amount: e.balances[0].amount,
                last_updated_height: height,
                account_id: accounts[e.address].id,
                type: AccountBalance.TYPE.NATIVE,
              })
            )
          )
          .onConflict(['account_id', 'denom'])
          .merge()
          .transacting(trx);
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
          balances: [{ denom: config.networkDenom, amount: results[index] }],
          spendable_balances: [
            { denom: config.networkDenom, amount: results[index] },
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
    this.viemClient = EtherJsClient.getViemClient();
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
