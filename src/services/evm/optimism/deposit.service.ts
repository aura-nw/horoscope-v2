import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { PublicClient, parseAbiItem } from 'viem';
import { getL2TransactionHashes } from 'viem/op-stack';
import _ from 'lodash';
import BullableService, { QueueHandler } from '../../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../constant';
import config from '../../../../config.json' assert { type: 'json' };
import '../../../../fetch-polyfill.js';
import { getViemClient } from '../../../common/utils/etherjs_client';
import { BlockCheckpoint, OptimismDeposit } from '../../../models';
import knex from '../../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.CrawlEvmProxyHistory.key,
  version: 1,
})
export default class CrawlOptimismDepositEVMService extends BullableService {
  viemClient!: PublicClient;

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_OPTIMISM_DEPOSIT,
    jobName: BULL_JOB_NAME.CRAWL_OPTIMISM_DEPOSIT,
  })
  async crawOptimismDeposit() {
    let blockCheckpoint = await BlockCheckpoint.query().findOne(
      'job_name',
      BULL_JOB_NAME.CRAWL_OPTIMISM_DEPOSIT
    );
    if (!blockCheckpoint) {
      blockCheckpoint = await BlockCheckpoint.query().insert({
        job_name: BULL_JOB_NAME.CRAWL_OPTIMISM_DEPOSIT,
        height: config.crawlOptimismDeposit.startBlockInL1,
      });
    }
    const latestBlockL1 = await this.viemClient.getBlockNumber();
    const startBlock = blockCheckpoint.height + 1;
    const endBlock = Math.min(
      startBlock + config.crawlOptimismDeposit.blocksPerCall - 1,
      parseInt(latestBlockL1.toString(), 10)
    );
    if (startBlock > endBlock) {
      return;
    }
    this.logger.info(
      `Crawl Optimism Deposit from block ${startBlock} to block ${endBlock}`
    );
    const events = await this.viemClient.getLogs({
      fromBlock: BigInt(startBlock),
      toBlock: BigInt(endBlock),
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      address: config.crawlOptimismDeposit.l1OptimismPortal,
      event: parseAbiItem(
        'event TransactionDeposited(address indexed from, address indexed to, uint256 indexed version, bytes opaqueData)'
      ),
    });
    const txPromises = events.map((event) =>
      this.viemClient.getTransactionReceipt({
        hash: event.transactionHash,
      })
    );
    const blockPromises = events.map((event) =>
      this.viemClient.getBlock({
        blockNumber: event.blockNumber,
        includeTransactions: false,
      })
    );
    const [blocks, txs] = await Promise.all([
      Promise.all(blockPromises),
      Promise.all(txPromises),
    ]);
    const blockByHeight = _.keyBy(blocks, 'number');
    const optimismDeposits: any[] = [];
    txs.forEach((tx) => {
      const l2Info = getL2TransactionHashes(tx);
      optimismDeposits.push({
        l1_block: parseInt(tx.blockNumber.toString(), 10),
        l1_tx_hash: tx.transactionHash,
        l1_sender: tx.from,
        l2_tx_hash: l2Info.toString(),
        gas_used: tx.gasUsed,
        timestamp: new Date(
          parseInt(
            blockByHeight[tx.blockNumber.toString()].timestamp.toString(),
            10
          ) * 1000
        ),
      });
    });
    await knex.transaction(async (trx) => {
      if (optimismDeposits.length > 0) {
        await trx.batchInsert(
          OptimismDeposit.tableName,
          optimismDeposits,
          config.crawlOptimismDeposit.chunkSize
        );
      }

      blockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(blockCheckpoint)
        .onConflict('job_name')
        .merge();
    });
  }

  async _start(): Promise<void> {
    this.viemClient = getViemClient(config.crawlOptimismDeposit.l1ChainId);
    this.createJob(
      BULL_JOB_NAME.CRAWL_OPTIMISM_DEPOSIT,
      BULL_JOB_NAME.CRAWL_OPTIMISM_DEPOSIT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlOptimismDeposit.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
