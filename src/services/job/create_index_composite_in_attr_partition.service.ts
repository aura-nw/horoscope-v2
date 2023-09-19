/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
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
  async jobCheckIfNeedCreateEventAttrPartition(_payload: {
    partitionName: string;
    needConcurrently: boolean;
  }) {
    const blockCheckpoint = await BlockCheckpoint.query().findOne({
      job_name: `${BULL_JOB_NAME.JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION}_${_payload.partitionName}`,
    });

    if (!blockCheckpoint) {
      await knex.transaction(async (trx) => {
        this.logger.info(
          `Creating composite index in event_attribute partition ${_payload.partitionName}`
        );

        const range = _payload.partitionName.match(/\d+/g);
        if (range?.length === 2) {
          // check if need concurently
          if (_payload.needConcurrently === true) {
            // use create index concurrently
            await knex.raw(
              `CREATE INDEX CONCURRENTLY IF NOT EXISTS event_attribute_partition_${range[0]}_${range[1]}_composite_index
                ON ${_payload.partitionName} USING btree
                (composite_key ASC NULLS LAST, value ASC NULLS LAST, block_height ASC NULLS LAST)
                INCLUDE(event_id, tx_id)
                WHERE length(value) >= 40 AND length(value) <= 75;`
            );
          } else {
            await knex
              .raw(
                `CREATE INDEX IF NOT EXISTS event_attribute_partition_${range[0]}_${range[1]}_composite_index
                ON ${_payload.partitionName} USING btree
                (composite_key ASC NULLS LAST, value ASC NULLS LAST, block_height ASC NULLS LAST)
                INCLUDE(event_id, tx_id)
                WHERE length(value) >= 40 AND length(value) <= 75;`
              )
              .transacting(trx);
          }
        } else {
          this.logger.error('partition table name not has range');
        }

        this.logger.info(
          `Creating composite index in event_attribute partition ${_payload.partitionName} done`
        );

        await BlockCheckpoint.query()
          .insert({
            height: 1,
            job_name: `${BULL_JOB_NAME.JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION}_${_payload.partitionName}`,
          })
          .transacting(trx);
      });
    }
  }

  @Action({
    name: SERVICE.V1.JobService.CreateIndexCompositeAttrPartition
      .actionCreateJob.key,
    params: {
      partitionName: 'string',
      needConcurrently: 'boolean',
    },
  })
  public async actionCreateJob(
    ctx: Context<{ partitionName: string; needConcurrently: boolean }>
  ) {
    this.createJob(
      BULL_JOB_NAME.JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION,
      BULL_JOB_NAME.JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION,
      {
        partitionName: ctx.params.partitionName,
        needConcurrently: ctx.params.needConcurrently,
      },
      {
        jobId: ctx.params.partitionName,
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
  }

  public async _start(): Promise<void> {
    const { partitionTableNames } =
      config.jobCreateCompositeIndexInAttributeTable;
    partitionTableNames.forEach((partitionTableName: string) => {
      let needConcurrently = false;
      // if this partition is latest then need concurently
      if (
        partitionTableName ===
        partitionTableNames[partitionTableNames.length - 1]
      ) {
        needConcurrently = true;
      }

      this.createJob(
        BULL_JOB_NAME.JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION,
        BULL_JOB_NAME.JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION,
        {
          partitionName: partitionTableName,
          needConcurrently,
        },
        {
          jobId: partitionTableName,
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
        }
      );
    });
    return super._start();
  }
}
