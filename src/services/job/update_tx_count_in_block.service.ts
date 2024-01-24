/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { Block } from '../../models';
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
    const listBlocks = await Block.query()
      .select('height', 'data')
      .whereNull('tx_count')
      .limit(config.jobUpdateTxCountInBlock.blocksPerCall);
    listBlocks.forEach(async (block) => {
      const txCount = block.data.block.data.txs.length;
      // eslint-disable-next-line no-param-reassign
      block.tx_count = txCount;
    });
    const stringListUpdates = listBlocks
      .map((block) => `(${block.height}, ${block.tx_count})`)
      .join(',');

    if (listBlocks.length > 0) {
      await knex.raw(`
        UPDATE block SET tx_count = temp.tx_count from (VALUES ${stringListUpdates}) as temp(height, tx_count) where temp.height = block.height
      `);
    } else {
      this.logger.info('No block need update tx_count');
    }
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
