import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import {
  BlockCheckpoint,
  EventAttribute,
  EvmEvent,
  EVMTransaction,
} from '../../models';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.JobService.CrawlEvmEvent.key,
  version: 1,
})
export default class CrawlEvmEventJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CRAWL_EVM_EVENT,
    jobName: BULL_JOB_NAME.JOB_CRAWL_EVM_EVENT,
  })
  async crawlEvmEventHandler(): Promise<void> {
    const [startBlock, endBlock, jobCheckpointUpdate] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.JOB_CRAWL_EVM_EVENT,
        [BULL_JOB_NAME.HANDLE_TRANSACTION_EVM],
        'jobCrawlEvmEvent'
      );

    this.logger.info(
      `Start crawl evm event from event attribute from block height ${startBlock} to ${endBlock}`
    );

    const evmEventAttr = await EventAttribute.query()
      .where('block_height', '>', startBlock)
      .andWhere('block_height', '<=', endBlock)
      .andWhere('key', 'txLog')
      .orderBy('event_id', 'ASC');

    if (evmEventAttr.length === 0) {
      jobCheckpointUpdate.height = endBlock;
      await BlockCheckpoint.query()
        .insert(jobCheckpointUpdate)
        .onConflict('job_name')
        .merge();
      this.logger.info(
        `No evm event found for height from ${startBlock} to ${endBlock}`
      );
      return;
    }

    const evmTransactions = await EVMTransaction.query()
      .where('height', '>', startBlock)
      .andWhere('height', '<=', endBlock)
      .select(['id', 'tx_id']);
    const mappingEvmTxId = {};
    evmTransactions.forEach((evmTransaction) => {
      mappingEvmTxId[evmTransaction.tx_id] = evmTransaction.id;
    });

    const evmEvents: EvmEvent[] = evmEventAttr.map((evmEvent) => {
      jobCheckpointUpdate.height = evmEvent.block_height;
      const valueParse = JSON.parse(evmEvent.value);
      return EvmEvent.fromJson({
        evm_tx_id: mappingEvmTxId[evmEvent.tx_id],
        tx_id: evmEvent.tx_id,
        address: valueParse.address,
        topics: { ...valueParse.topics },
        block_height: evmEvent.block_height,
        tx_hash: valueParse.transactionHash,
        block_hash: valueParse.blockHash,
        tx_index: valueParse.transactionIndex,
      });
    });

    await knex.transaction(async (trx) => {
      await EvmEvent.query().insert(evmEvents).transacting(trx);
      await BlockCheckpoint.query()
        .transacting(trx)
        .insert(jobCheckpointUpdate)
        .onConflict('job_name')
        .merge();
    });
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.JOB_CRAWL_EVM_EVENT,
      BULL_JOB_NAME.JOB_CRAWL_EVM_EVENT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobCrawlEvmEvent.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
