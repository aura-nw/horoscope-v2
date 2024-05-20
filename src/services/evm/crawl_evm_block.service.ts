import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { BlockCheckpoint, EVMBlock } from '../../models';
import EtherJsClient from '../../common/utils/etherjs_client';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from './constant';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.CrawlEvmBlock.key,
  version: 1,
})
export default class CrawlEvmBlockService extends BullableService {
  etherJsClient!: EtherJsClient;

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_EVM_BLOCK,
    jobName: BULL_JOB_NAME.CRAWL_EVM_BLOCK,
  })
  async crawlEvmBlock() {
    const latestBlock = await this.etherJsClient.etherJsClient.getBlockNumber();
    this.logger.info(`Latest block network: ${latestBlock}`);

    let blockCheckpoint = await BlockCheckpoint.query().findOne({
      job_name: BULL_JOB_NAME.CRAWL_EVM_BLOCK,
    });
    if (!blockCheckpoint) {
      blockCheckpoint = await BlockCheckpoint.query().insert({
        job_name: BULL_JOB_NAME.CRAWL_EVM_BLOCK,
        height: config.crawlEvmBlock.startBlock,
      });
    }
    this.logger.info(`Current block checkpoint: ${blockCheckpoint?.height}`);

    // crawl block from startBlock to endBlock
    const startBlock = blockCheckpoint.height + 1;
    let endBlock = startBlock + config.crawlEvmBlock.blocksPerCall - 1;
    if (endBlock > latestBlock) {
      endBlock = latestBlock;
    }
    this.logger.info(`startBlock: ${startBlock} endBlock: ${endBlock}`);
    const blockQueries = [];
    for (let i = startBlock; i <= endBlock; i += 1) {
      blockQueries.push(this.etherJsClient.etherJsClient.getBlock(i, true));
    }
    const res = await Promise.all(blockQueries);
    // this.logger.info(res);
    const EvmBlocks: EVMBlock[] = [];
    if (res.length > 0) {
      res.forEach((block) => {
        if (block) {
          EvmBlocks.push(
            EVMBlock.fromJson({
              height: block.number,
              hash: block.hash,
              parent_hash: block.parentHash,
              date: block.date,
              difficulty: block.difficulty,
              gas_limit: block.gasLimit,
              gas_used: block.gasUsed,
              miner: block.miner,
              nonce: block.nonce,
              receipts_root: block.receiptsRoot,
              state_root: block.stateRoot,
              tx_count: block.transactions.length,
              extra_data: block.extraData,
              transactions: JSON.stringify(block.prefetchedTransactions),
            })
          );
        }
      });
      await knex.transaction(async (trx) => {
        await EVMBlock.query().insert(EvmBlocks).transacting(trx);
        await BlockCheckpoint.query()
          .update(
            BlockCheckpoint.fromJson({
              job_name: BULL_JOB_NAME.CRAWL_EVM_BLOCK,
              height: endBlock,
            })
          )
          .where({
            job_name: BULL_JOB_NAME.CRAWL_EVM_BLOCK,
          })
          .transacting(trx);
      });
    }
  }

  public async _start(): Promise<void> {
    this.etherJsClient = new EtherJsClient();
    this.createJob(
      BULL_JOB_NAME.CRAWL_EVM_BLOCK,
      BULL_JOB_NAME.CRAWL_EVM_BLOCK,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlEvmBlock.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
