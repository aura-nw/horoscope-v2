import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { TransactionReceipt, TransactionResponse } from 'ethers';
import { fromHex } from '@cosmjs/encoding';
import { BlockCheckpoint, EVMBlock } from '../../models';
import EtherJsClient from '../../common/utils/etherjs_client';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from './constant';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.CrawlEvmTransaction.key,
  version: 1,
})
export default class CrawlEvmTransactionService extends BullableService {
  etherJsClient!: EtherJsClient;

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
      .select('height', 'transactions', 'tx_count')
      .where('height', '>', startBlock)
      .where('height', '<=', endBlock)
      .orderBy('height', 'asc');

    const offchainTxs: TransactionResponse[] = blocks
      .map((block) => block.transactions)
      .flat();
    const receiptTxs = await this.getListTxReceipt(blocks);
    if (receiptTxs.find((tx) => tx == null)) {
      throw Error('Found null transaction receipt');
    }

    if (receiptTxs.length !== offchainTxs.length) {
      throw Error('Transaction count not match');
    }
    const evmTxs: any[] = [];
    const evmEvents: any[] = [];
    offchainTxs.forEach((offchainTx) => {
      const receiptTx = receiptTxs.find(
        (tx) => tx && tx.hash && tx.hash === offchainTx.hash
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
        data: offchainTx.data === '0x' ? null : offchainTx.data.substring(2),
        nonce: offchainTx.nonce,
        height: offchainTx.blockNumber,
        index: offchainTx.index,
        gas_used: receiptTx.gasUsed,
        gas_price: receiptTx.gasPrice,
        gas_limit: offchainTx.gasLimit,
        type: offchainTx.type,
        status: receiptTx.status,
        contract_address: receiptTx.contractAddress,
      });
    });

    await knex.transaction(async (trx) => {
      if (evmTxs.length > 0) {
        // const resultInsertTxs = await EVMTransaction.query()
        //   .insert(evmTxs)
        //   .transacting(trx);
        const resultInsertTxs = await knex
          .batchInsert(
            'evm_transaction',
            evmTxs,
            config.crawlEvmTransaction.chunkSize
          )
          .returning(['id', 'hash'])
          .transacting(trx);
        this.logger.debug('result insert evmTxs: ', resultInsertTxs);
        if (evmEvents.length > 0) {
          evmEvents.forEach((evmEvent) => {
            const foundTx = resultInsertTxs.find(
              (tx) => tx.hash === evmEvent.tx_hash
            );
            if (!foundTx) {
              throw Error('Transaction not found');
            }
            // eslint-disable-next-line no-param-reassign
            evmEvent.evm_tx_id = foundTx.id;
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

  async getListTxReceipt(
    blocks: EVMBlock[]
  ): Promise<(TransactionReceipt | null)[]> {
    const promises = [];
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      for (let j = 0; j < block.transactions.length; j += 1) {
        const tx = block.transactions[j];
        promises.push(
          this.etherJsClient.etherJsClient.getTransactionReceipt(tx.hash)
        );
      }
    }
    const receiptTxs = await Promise.all(promises);
    return receiptTxs;
  }

  public async _start(): Promise<void> {
    this.etherJsClient = new EtherJsClient();
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
