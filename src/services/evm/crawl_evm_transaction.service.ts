import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { fromHex } from '@cosmjs/encoding';
import {
  PublicClient,
  FormattedTransaction,
  hexToBytes,
  bytesToHex,
} from 'viem';
import _ from 'lodash';
import { OpStackTransactionReceipt } from 'viem/chains';
import { BlockCheckpoint, EVMBlock } from '../../models';
import { getViemClient } from '../../common/utils/etherjs_client';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from './constant';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';
import '../../../fetch-polyfill.js';

type CustomFormattedTransaction = FormattedTransaction & {
  timestamp: number;
};

@Service({
  name: SERVICE.V1.CrawlEvmTransaction.key,
  version: 1,
})
export default class CrawlEvmTransactionService extends BullableService {
  viemJsClient!: PublicClient;

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_EVM_TRANSACTION,
    jobName: BULL_JOB_NAME.CRAWL_EVM_TRANSACTION,
  })
  async crawlEvmTransaction() {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_EVM_TRANSACTION,
        [BULL_JOB_NAME.CRAWL_EVM_BLOCK],
        config.crawlEvmTransaction.key
      );
    this.logger.info(
      `Crawl evm_transaction from block ${startBlock} to ${endBlock}`
    );
    if (startBlock >= endBlock) {
      return;
    }

    const blocks = await EVMBlock.query()
      .select('height', 'transactions', 'tx_count', 'timestamp')
      .where('height', '>', startBlock)
      .andWhere('height', '<=', endBlock)
      .orderBy('height', 'asc');
    const { evmTxs, evmEvents } = await this.getEVMTxsFromBlocks(blocks);
    await knex.transaction(async (trx) => {
      if (evmTxs.length > 0) {
        const insertedTxByHash = _.keyBy(
          await knex
            .batchInsert(
              'evm_transaction',
              evmTxs,
              config.crawlEvmTransaction.chunkSize
            )
            .returning(['id', 'hash'])
            .transacting(trx),
          (e) => bytesToHex(e.hash)
        );
        if (evmEvents.length > 0) {
          // eslint-disable-next-line array-callback-return
          evmEvents.map((evmEvent) => {
            // eslint-disable-next-line no-param-reassign
            evmEvent.evm_tx_id = insertedTxByHash[evmEvent.tx_hash].id;
          });
          await knex
            .batchInsert(
              'evm_event',
              evmEvents,
              config.crawlEvmTransaction.chunkSize
            )
            .transacting(trx);
        }
      }
      if (blockCheckpoint) {
        blockCheckpoint.height = endBlock;
        await BlockCheckpoint.query()
          .insert(blockCheckpoint)
          .onConflict('job_name')
          .merge()
          .transacting(trx);

        // insert block checkpoint evm event
        await BlockCheckpoint.query()
          .insert(
            BlockCheckpoint.fromJson({
              job_name: BULL_JOB_NAME.JOB_CRAWL_EVM_EVENT,
              height: endBlock,
            })
          )
          .onConflict('job_name')
          .merge()
          .transacting(trx);
      }
    });
  }

  async getEVMTxsFromBlocks(
    blocks: EVMBlock[]
  ): Promise<{ evmTxs: any[]; evmEvents: any[] }> {
    const evmTxs: any[] = [];
    const evmEvents: any[] = [];
    const offchainTxs: CustomFormattedTransaction[] = blocks
      .map((block) => {
        block.transactions.forEach((tx: any) => {
          // eslint-disable-next-line no-param-reassign
          tx.timestamp = block.timestamp;
        });
        return block.transactions;
      })
      .flat();
    const receiptTxs = await this.getListTxReceipt(blocks);
    const receiptTxsByHash = _.keyBy(receiptTxs, 'transactionHash');
    if (receiptTxs.find((tx) => tx == null)) {
      throw Error('Found null transaction receipt');
    }

    if (receiptTxs.length !== offchainTxs.length) {
      throw Error('Transaction count not match');
    }
    offchainTxs.forEach((offchainTx) => {
      const receiptTx = receiptTxsByHash[offchainTx.hash];
      if (!receiptTx) {
        throw Error('Transaction receipt not found');
      }

      evmEvents.push(
        ...receiptTx.logs.map((log) => ({
          address: log.address,
          data: log.data === '0x' ? null : fromHex(log.data.substring(2)),
          block_height: Number(log.blockNumber),
          block_hash: log.blockHash,
          tx_index: Number(log.transactionIndex),
          topic0: log.topics[0],
          topic1: log.topics[1],
          topic2: log.topics[2],
          topic3: log.topics[3],
          tx_hash: log.transactionHash,
        }))
      );

      evmTxs.push({
        from: offchainTx.from ? hexToBytes(offchainTx.from) : null,
        to: offchainTx.to ? hexToBytes(offchainTx.to) : null,
        hash: offchainTx.hash ? hexToBytes(offchainTx.hash) : null,
        data: offchainTx.input ? hexToBytes(offchainTx.input) : null,
        nonce: offchainTx.nonce,
        height: offchainTx.blockNumber,
        index: offchainTx.transactionIndex,
        gas_used: Number(receiptTx.gasUsed),
        gas_price: Number(receiptTx.effectiveGasPrice),
        gas: offchainTx.gas,
        type: offchainTx.type,
        status: Number(receiptTx.status),
        contract_address: receiptTx.contractAddress
          ? hexToBytes(receiptTx.contractAddress)
          : null,
        value: offchainTx.value,
        timestamp: offchainTx.timestamp,
        additional_data: config.crawlEvmTransaction.additionalData.optimism
          ? JSON.stringify({
              l1_fee: receiptTx.l1Fee?.toString(),
              l1_fee_scalar: receiptTx.l1FeeScalar?.toString(),
              l1_gas_price: receiptTx.l1GasPrice?.toString(),
              l1_gas_used: receiptTx.l1GasUsed?.toString(),
            })
          : null,
      });
    });
    return {
      evmTxs,
      evmEvents,
    };
  }

  async getListTxReceipt(
    blocks: EVMBlock[]
  ): Promise<OpStackTransactionReceipt[]> {
    const promises = [];
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      promises.push(
        this.viemJsClient.request<any>({
          method: 'eth_getBlockReceipts',
          params: [`0x${block.height.toString(16)}`],
        })
      );
    }
    const receiptTxs = _.flatten(await Promise.all(promises));
    return receiptTxs as OpStackTransactionReceipt[];
  }

  public async _start(): Promise<void> {
    this.viemJsClient = getViemClient();
    this.createJob(
      BULL_JOB_NAME.CRAWL_EVM_TRANSACTION,
      BULL_JOB_NAME.CRAWL_EVM_TRANSACTION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlEvmTransaction.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
