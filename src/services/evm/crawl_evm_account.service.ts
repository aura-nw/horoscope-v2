import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { PublicClient } from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE, ZERO_ADDRESS } from './constant';
import { Account, BlockCheckpoint, EVMTransaction } from '../../models';
import EtherJsClient from '../../common/utils/etherjs_client';
import '../../../fetch-polyfill.js';
import knex from '../../common/utils/db_connection';

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
      const participants = (
        await EVMTransaction.query()
          .where('height', '>', startBlock)
          .where('height', '<=', endBlock)
          .orderBy('height', 'asc')
          .select('from', 'to')
          .transacting(trx)
      ).reduce((acc: string[], curr) => {
        if (curr.from !== ZERO_ADDRESS) {
          acc.push(curr.from);
        }
        if (curr.to && curr.to !== ZERO_ADDRESS) {
          acc.push(curr.to);
        }
        return acc;
      }, []);
      const uniqueParticipants = Array.from(new Set(participants));
      const accounts = await this.getEvmAccountInstances(uniqueParticipants);
      if (accounts.length > 0) {
        await Account.query()
          .transacting(trx)
          .insert(accounts)
          .onConflict(['address'])
          .merge();
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

  async getEvmAccountInstances(participants: string[]) {
    const balances = await Promise.all(
      participants.map((addr) =>
        this.viemClient.getBalance({ address: addr as `0x${string}` })
      )
    );
    const nonces = await Promise.all(
      participants.map((addr) =>
        this.viemClient.getTransactionCount({ address: addr as `0x${string}` })
      )
    );
    return participants.map((e, index) =>
      Account.fromJson({
        address: e,
        balances: [{ denom: config.networkDenom, amount: balances[index] }],
        spendable_balances: [
          { denom: config.networkDenom, amount: balances[index] },
        ],
        type: null,
        pubkey: {},
        account_number: 0,
        sequence: nonces[index],
        evm_address: e,
      })
    );
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
