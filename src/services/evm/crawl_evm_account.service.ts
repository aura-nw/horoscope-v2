/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Knex } from 'knex';
import _, { Dictionary } from 'lodash';
import { Context } from 'moleculer';
import {
  bytesToHex,
  PublicClient,
  recoverAddress,
  recoverPublicKey,
} from 'viem';
import { ethers } from 'ethers';
import config from '../../../config.json' assert { type: 'json' };
import '../../../fetch-polyfill.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import knex, { batchUpdate } from '../../common/utils/db_connection';
import { getViemClient } from '../../common/utils/etherjs_client';
import {
  Account,
  AccountBalance,
  BlockCheckpoint,
  EVMBlock,
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
        [
          BULL_JOB_NAME.CRAWL_EVM_TRANSACTION,
          BULL_JOB_NAME.EVM_CRAWL_INTERNAL_TX,
        ],
        config.crawlEvmAccount.key
      );
    this.logger.info(
      `Crawl evm_account from block ${startBlock} to ${endBlock}`
    );
    const accountsAddress: Set<string> = new Set();
    const [fromTx, toTx, participants] = await Promise.all([
      EVMTransaction.query()
        .select('id')
        .findOne('height', '>', startBlock)
        .orderBy('height', 'asc')
        .orderBy('index', 'asc')
        .limit(1),
      EVMTransaction.query()
        .select('id')
        .findOne('height', '<=', endBlock)
        .orderBy('height', 'desc')
        .orderBy('index', 'desc')
        .limit(1),
      EVMTransaction.query()
        .where('height', '>', startBlock)
        .where('height', '<=', endBlock)
        .orderBy('height', 'asc')
        .orderBy('index', 'asc')
        .select('from', 'to', 'contract_address as contractAddress'),
    ]);

    if (!fromTx || !toTx) {
      return;
    }

    const participantsFromInternal = await EvmInternalTransaction.query()
      .where('evm_tx_id', '>=', fromTx.id)
      .andWhere('evm_tx_id', '<=', toTx.id)
      .andWhere('evm_internal_transaction.error', null)
      .select('evm_internal_transaction.from', 'evm_internal_transaction.to');
    participants.forEach((participant) => {
      ['from', 'to', 'contractAddress'].forEach((key) => {
        if (participant[key]) {
          // eslint-disable-next-line no-param-reassign
          participant[key] = bytesToHex(participant[key]);
        }
      });
      if (String(participant.from) !== ZERO_ADDRESS) {
        accountsAddress.add(String(participant.from));
      }
      if (participant.to && String(participant.to) !== ZERO_ADDRESS) {
        accountsAddress.add(String(participant.to));
      }
      if (participant.contractAddress) {
        accountsAddress.add(participant.contractAddress);
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
    await knex.transaction(async (trx) => {
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

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_PUBKEY,
    jobName: BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_PUBKEY,
  })
  async crawlEvmAccountPubkey() {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_PUBKEY,
        [BULL_JOB_NAME.CRAWL_EVM_ACCOUNT],
        config.crawlEvmAccountPubkey.key
      );
    this.logger.info(
      `Crawl evm account pubkey from block ${startBlock} to ${endBlock}`
    );
    if (startBlock >= endBlock) {
      return;
    }
    const listBlock = await EVMBlock.query()
      .select('transactions')
      .where('height', '>', startBlock)
      .andWhere('height', '<=', endBlock);
    const listAccountDict: any = {};
    await Promise.all(
      listBlock.map(async (block) => {
        const listTxs = block.transactions;
        await Promise.all(
          listTxs.map(async (tx: any) => {
            const txData = {
              gasPrice: tx.gasPrice,
              gasLimit: tx.gas,
              value: tx.value,
              nonce: tx.nonce,
              data: tx.input,
              chainId: tx.chainId,
              type: Number(tx.typeHex),
              maxFeePerGas: tx.maxFeePerGas,
              maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
              to: tx.to,
            };
            const txs = (await ethers.resolveProperties(txData)) as any;
            const rawTx = ethers.Transaction.from(txs).unsignedSerialized; // returns RLP encoded tx
            const sig = {
              r: tx.r,
              s: tx.s,
              v: tx.v,
            };
            const signature = ethers.Signature.from(sig).serialized as any;
            const msgHash = ethers.keccak256(rawTx); // as specified by ECDSA
            const msgBytes = ethers.getBytes(msgHash); // create binary hash
            const recoveredPubKey = await recoverPublicKey({
              hash: msgBytes,
              signature,
            });

            const recoveredAddress = await recoverAddress({
              hash: msgBytes,
              signature,
            });
            if (tx.from !== recoveredAddress.toLowerCase()) {
              this.logger.error(`cannot recover address at ${tx.hash}`);
              throw Error(`cannot recover address at ${tx.hash}`);
            }
            listAccountDict[tx.from] = {
              pubkey: JSON.stringify({
                pubkeyEVM: recoveredPubKey,
              }),
            };
          })
        );
      })
    );

    await knex.transaction(async (trx) => {
      if (Object.keys(listAccountDict).length > 0) {
        const listAccountDB = await Account.query().whereIn(
          'address',
          Object.keys(listAccountDict)
        );
        const listAccount = Object.keys(listAccountDict).map((e) => ({
          account: e,
          pubkey: { type: 'jsonb', value: listAccountDict[e].pubkey },
          id: listAccountDB.find((a) => a.evm_address === e)?.id,
        }));
        await batchUpdate(trx, 'account', listAccount, ['pubkey']);
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
    await this.createJob(
      BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_PUBKEY,
      BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_PUBKEY,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlEvmAccountPubkey.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
