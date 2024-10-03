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
  hexToBytes,
  keccak256,
  PublicClient,
  recoverAddress,
  recoverPublicKey,
  serializeSignature,
} from 'viem';
import { ethers } from 'ethers';
import { toBech32 } from '@cosmjs/encoding';
import { pubkeyToRawAddress } from '@cosmjs/tendermint-rpc';
import { Secp256k1 } from '@cosmjs/crypto';
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

    const existAccount = await Account.query()
      .select('id', 'evm_address')
      .whereIn('evm_address', Array.from(accountsAddress));

    const existAccountByEvmAddress = _.keyBy(existAccount, 'evm_address');

    const newAccountsInstances = Array.from(accountsAddress)
      .filter((account) => !existAccountByEvmAddress[account])
      .map((account) => ({
        address: account,
        evm_address: account,
        balances: JSON.stringify([{ denom: config.networkDenom, amount: '0' }]),
        spendable_balances: JSON.stringify([
          { denom: config.networkDenom, amount: '0' },
        ]),
        type: null,
        pubkey: {},
        account_number: 0,
        sequence: 0,
      }));
    const accountInserted: Account[] = [];
    await knex.transaction(async (trx) => {
      if (newAccountsInstances.length > 0) {
        const accountInserted: any[] = await knex
          .batchInsert(
            'account',
            newAccountsInstances,
            config.crawlEvmAccount.batchSize
          )
          // @ts-ignore
          .returning(['id', 'evm_address'])
          .transacting(trx);
        const accountInsertedByEvmAddress = _.keyBy(
          accountInserted,
          'evm_address'
        );
        await knex
          .batchInsert(
            'account_balance',
            newAccountsInstances.map((account) =>
              AccountBalance.fromJson({
                denom: config.networkDenom,
                amount: 0,
                last_updated_height: 0,
                account_id:
                  accountInsertedByEvmAddress[account.evm_address]?.id,
                type: AccountBalance.TYPE.NATIVE,
              })
            ),
            config.crawlEvmAccount.batchSize
          )
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
    await Promise.all([
      ...accountInserted.map(async (account) =>
        this.createJob(
          BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_BALANCE_NONCE,
          BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_BALANCE_NONCE,
          {
            evm_address: account.evm_address,
            id: account.id,
          },
          {
            jobId: account.evm_address,
            removeOnComplete: true,
            removeOnFail: false,
            attempts: config.jobRetryAttempt,
            backoff: config.jobRetryBackoff,
          }
        )
      ),
      ...existAccount.map(async (account) =>
        this.createJob(
          BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_BALANCE_NONCE,
          BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_BALANCE_NONCE,
          {
            evm_address: account.evm_address,
            id: account.id,
          },
          {
            jobId: account.evm_address,
            removeOnComplete: true,
            removeOnFail: false,
            attempts: config.jobRetryAttempt,
            backoff: config.jobRetryBackoff,
          }
        )
      ),
    ]);
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
          .onConflict(['evm_address'])
          .merge(),
        'evm_address'
      );
      await AccountBalance.query()
        .insert(
          batchAccounts.map((e) =>
            AccountBalance.fromJson({
              denom: config.networkDenom,
              amount: e.balances[0].amount,
              last_updated_height: lastUpdateHeight,
              account_id: accounts[e.evm_address].id,
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
    queueName: BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_BALANCE_NONCE,
    jobName: BULL_JOB_NAME.CRAWL_EVM_ACCOUNT_BALANCE_NONCE,
    concurrency: config.crawlEvmAccountBalanceNonce.concurrency,
  })
  async crawlEvmAccountBalanceNonce(_payload: {
    evm_address: string;
    id: number;
  }) {
    this.logger.debug(
      `Crawl evm_account balance and nonce for ${_payload.evm_address}`
    );
    const [accountsInstances, height] = await this.getEvmAccountInstances([
      _payload.evm_address,
    ]);
    if (accountsInstances.length === 0) {
      return;
    }
    const accountBalanceInstance = await AccountBalance.query().findOne(
      'account_id',
      _payload.id
    );
    if (!accountBalanceInstance) {
      throw Error(`Missing account_balance_id: ${_payload.id}`);
    }
    await knex.transaction(async (trx) => {
      await Account.query()
        .patch({
          balances: accountsInstances[0].balances,
          spendable_balances: accountsInstances[0].balances,
          sequence: accountsInstances[0].sequence,
        })
        .where({
          id: _payload.id,
        })
        .transacting(trx);

      await AccountBalance.query()
        .patch({
          last_updated_height: height,
          amount: accountsInstances[0].balances[0].amount,
        })
        .where({
          id: accountBalanceInstance?.id,
          denom: config.networkDenom,
          type: AccountBalance.TYPE.NATIVE,
        })
        .transacting(trx);
    });
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
    const listTxByFrom: any = {};
    const listTx = listBlock.flatMap((block) => block.transactions);
    listTx.forEach((tx) => {
      if (!listTxByFrom[tx.from]) {
        listTxByFrom[tx.from] = tx;
      }
    });

    const listAccountDict: any = {};
    await Promise.all(
      Object.values(listTxByFrom).map(async (tx: any) => {
        const txData = {
          gasPrice: tx.gasPrice,
          gasLimit: tx.gas,
          // gas: tx.gas,
          value: tx.value,
          nonce: tx.nonce,
          data: tx.input,
          chainId: tx.chainId,
          type: Number(tx.typeHex),
          maxFeePerGas: tx.maxFeePerGas,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
          to: tx.to,
        };
        // const txs = (await ethers.resolveProperties(txData)) as any;
        const rawTx = ethers.Transaction.from(txData).unsignedSerialized; // returns RLP encoded tx
        // currently cannot use viem ??!! This always is not the same rawTx
        // const serializedViem = toRlp(
        //   serializeTransaction({
        //     gasPrice: txData.gasPrice,
        //     gas: txData.gasLimit,
        //     value: txData.value,
        //     nonce: txData.nonce,
        //     data: txData.data,
        //     chainId: txData.chainId,
        //     type: tx.type,
        //     maxFeePerGas: txData.maxFeePerGas,
        //     maxPriorityFeePerGas: txData.maxPriorityFeePerGas,
        //     to: txData.to,
        //   })
        // );
        const sig = {
          r: tx.r,
          s: tx.s,
          v: BigInt(tx.v),
          yParity: tx.yParity,
        };
        // const signature = ethers.Signature.from(sig).serialized as any;
        const signatureViem = serializeSignature(sig);

        const msgHash = keccak256(rawTx as `0x${string}`); // as specified by ECDSA
        const msgBytes = hexToBytes(msgHash); // create binary hash
        const [recoveredPubKey, recoveredAddress] = await Promise.all([
          recoverPublicKey({
            hash: msgBytes,
            signature: signatureViem,
          }),
          recoverAddress({
            hash: msgBytes,
            signature: signatureViem,
          }),
        ]);

        if (tx.from !== recoveredAddress.toLowerCase()) {
          this.logger.error(`cannot recover address at ${tx.hash}`);
          throw Error(`cannot recover address at ${tx.hash}`);
        }

        const compressPubkey = Secp256k1.compressPubkey(
          hexToBytes(recoveredPubKey)
        );
        const bech32Add = toBech32(
          `${config.networkPrefixAddress}`,
          pubkeyToRawAddress('secp256k1', compressPubkey)
        );

        listAccountDict[tx.from] = {
          pubkey: JSON.stringify({
            pubkeyEVM: recoveredPubKey,
          }),
          bech32Add,
        };
      })
    );

    const listAccountDB = await Account.query().whereIn(
      'evm_address',
      Object.keys(listAccountDict)
    );
    const listAccount = Object.keys(listAccountDict).map((e) => ({
      account: e,
      pubkey: { type: 'jsonb', value: listAccountDict[e].pubkey },
      address: listAccountDict[e].bech32Add,
      id: listAccountDB.find((a) => a.evm_address === e)?.id,
    }));
    await knex.transaction(async (trx) => {
      if (listAccount.length > 0) {
        await batchUpdate(trx, 'account', listAccount, ['pubkey', 'address']);
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
