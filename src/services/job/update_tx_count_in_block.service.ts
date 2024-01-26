/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { BlockCheckpoint } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.JobService.UpdateTxCountInBlock.key,
  version: 1,
})
export default class UpdateTxCountInBlock extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_UPDATE_TX_COUNT_IN_BLOCK,
    jobName: BULL_JOB_NAME.JOB_UPDATE_TX_COUNT_IN_BLOCK,
  })
  async updateTxCountInBlock() {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.JOB_UPDATE_TX_COUNT_IN_BLOCK,
        [BULL_JOB_NAME.CRAWL_BLOCK],
        config.jobUpdateTxCountInBlock.key
      );
    this.logger.info(`Update tx count from block ${startBlock} to ${endBlock}`);
    if (startBlock > endBlock) {
      return;
    }

    await knex.transaction(async (trx) => {
      await knex.raw(
        `UPDATE block set tx_count = jsonb_array_length( (((data->>'block')::jsonb->>'data')::jsonb->>'txs')::jsonb) where height > ${startBlock} and height <= ${endBlock} and tx_count is NULL`
      );
      if (blockCheckpoint) {
        blockCheckpoint.height = endBlock;
        await BlockCheckpoint.query()
          .insert(blockCheckpoint)
          .onConflict('job_name')
          .merge()
          .returning('id')
          .transacting(trx);
      }
    });
  }

  async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.JOB_UPDATE_TX_COUNT_IN_BLOCK,
      BULL_JOB_NAME.JOB_UPDATE_TX_COUNT_IN_BLOCK,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobUpdateTxCountInBlock.millisecondCrawl,
        },
      }
    );

    return super._start();
  }
}
