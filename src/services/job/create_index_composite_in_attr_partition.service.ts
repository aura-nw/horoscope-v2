/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { Knex } from 'knex';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import { BlockCheckpoint } from '../../models';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.JobService.CreateIndexCompositeAttrPartition.key,
  version: 1,
})
export default class CreateIndexCompositeAttrPartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION,
    jobName: BULL_JOB_NAME.JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION,
  })
  async jobCheckIfNeedCreateEventAttrPartition() {
    const blockCheckpoint = await BlockCheckpoint.query().findOne({
      job_name: BULL_JOB_NAME.JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION,
    });

    if (!blockCheckpoint) {
      await knex.transaction(async (trx) => {
        await this.createCompositeKeyIndex(trx);
        await BlockCheckpoint.query()
          .insert({
            height: 1,
            job_name: BULL_JOB_NAME.JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION,
          })
          .transacting(trx);
      });
    }
  }

  async createCompositeKeyIndex(trx: Knex.Transaction) {
    this.logger.info('Creating composite index in event_attribute partition');
    const { partitionTableNames } =
      config.jobCreateCompositeIndexInAttributeTable;

    // eslint-disable-next-line no-restricted-syntax
    for (const partitionName of partitionTableNames) {
      this.logger.info('partition:', partitionName);
      const range = partitionName.match(/\d+/g);
      if (range?.length === 2) {
        // check this is latest partition or not?
        if (
          partitionName === partitionTableNames[partitionTableNames.length - 1]
        ) {
          // use create index concurrently
          await knex.raw(
            `CREATE INDEX CONCURRENTLY IF NOT EXISTS event_attribute_partition_${range[0]}_${range[1]}_composite_index
            ON ${partitionName} USING btree
            (composite_key ASC NULLS LAST, value ASC NULLS LAST, block_height ASC NULLS LAST)
            INCLUDE(event_id, tx_id)
            WHERE length(value) >= 40 AND length(value) <= 75;`
          );
        } else {
          await knex
            .raw(
              `CREATE INDEX IF NOT EXISTS event_attribute_partition_${range[0]}_${range[1]}_composite_index
            ON ${partitionName} USING btree
            (composite_key ASC NULLS LAST, value ASC NULLS LAST, block_height ASC NULLS LAST)
            INCLUDE(event_id, tx_id)
            WHERE length(value) >= 40 AND length(value) <= 75;`
            )
            .transacting(trx);
        }
      } else {
        this.logger.error('partition table name not has range');
      }
    }
    this.logger.info(
      'Creating composite index in event_attribute partition done'
    );
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION,
      BULL_JOB_NAME.JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
    return super._start();
  }
}
