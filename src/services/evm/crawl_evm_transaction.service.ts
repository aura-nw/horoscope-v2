import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { fromHex } from '@cosmjs/encoding';
import { PublicClient, FormattedTransaction } from 'viem';
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
        config.crawlTransaction.key
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
          'hash'
        );
        if (evmEvents.length > 0) {
          evmEvents.forEach((evmEvent) => {
            // eslint-disable-next-line no-param-reassign
            evmEvent.evm_tx_id = insertedTxByHash[evmEvent.tx_hash].id;
          });
          const resultInsert = await knex
            .batchInsert(
              'evm_event',
              evmEvents,
              config.crawlEvmTransaction.chunkSize
            )
            .returning('id')
            .transacting(trx);
          this.logger.debug('result insert evmEvents: ', resultInsert);
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
    if (receiptTxs.find((tx) => tx == null)) {
      throw Error('Found null transaction receipt');
    }

    if (receiptTxs.length !== offchainTxs.length) {
      throw Error('Transaction count not match');
    }
    offchainTxs.forEach((offchainTx) => {
      const receiptTx = receiptTxs.find(
        (tx) =>
          tx && tx.transactionHash && tx.transactionHash === offchainTx.hash
      );
      if (!receiptTx) {
        throw Error('Transaction receipt not found');
      }

      evmEvents.push(
        ...receiptTx.logs.map((log) => ({
          address: log.address,
          data: log.data === '0x' ? null : fromHex(log.data.substring(2)),
          block_height: log.blockNumber,
          block_hash: log.blockHash,
          tx_index: log.transactionIndex,
          topic0: log.topics[0],
          topic1: log.topics[1],
          topic2: log.topics[2],
          topic3: log.topics[3],
          tx_hash: log.transactionHash,
        }))
      );

      evmTxs.push({
        from: offchainTx.from.toLowerCase(),
        to: offchainTx.to?.toLowerCase(),
        hash: offchainTx.hash,
        data: offchainTx.input ? offchainTx.input.substring(2) : null,
        nonce: offchainTx.nonce,
        height: offchainTx.blockNumber,
        index: offchainTx.transactionIndex,
        gas_used: receiptTx.gasUsed,
        gas_price: receiptTx.effectiveGasPrice,
        gas: offchainTx.gas,
        type: offchainTx.type,
        status: receiptTx.status === 'success' ? 1 : 0,
        contract_address: receiptTx.contractAddress,
        value: offchainTx.value,
        timestamp: offchainTx.timestamp,
        l1_fee: receiptTx.l1Fee,
        l1_fee_scalar: receiptTx.l1FeeScalar,
        l1_gas_price: receiptTx.l1GasPrice,
        l1_gas_used: receiptTx.l1GasUsed,
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
      for (let j = 0; j < block.transactions.length; j += 1) {
        const tx = block.transactions[j];
        promises.push(
          this.viemJsClient.getTransactionReceipt({ hash: tx.hash })
        );
      }
    }
    const receiptTxs = await Promise.all(promises);
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
