import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import { BlockCheckpoint } from '../../models';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.JobService.CreateEventAttrPartition.key,
  version: 1,
})
export default class CreateEventAttrPartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CREATE_EVENT_ATTR_PARTITION,
    jobName: BULL_JOB_NAME.JOB_CREATE_EVENT_ATTR_PARTITION,
  })
  async jobCreateEventAttrPartition(_payload: {
    startBlock: number;
    endBlock: number;
  }) {
    this.logger.info(
      `Job create event attribute partition from ${_payload.startBlock} to ${_payload.endBlock}`
    );
    const tableName = `event_attribute_partition_${_payload.startBlock}_${_payload.endBlock}`;
    await knex.transaction(async (trx) => {
      // create table
      await knex
        .raw(
          `create table ${tableName} (like ${config.jobCheckNeedCreateEventAttributePartition.templateTable} including all excluding constraints)`
        )
        .transacting(trx);
      // attach table to partition table
      await knex
        .raw(
          `alter table event_attribute attach partition ${tableName} for values from (${_payload.startBlock}) to (${_payload.endBlock})`
        )
        .transacting(trx);
      await BlockCheckpoint.query()
        .update(
          BlockCheckpoint.fromJson({
            job_name: BULL_JOB_NAME.JOB_CREATE_EVENT_ATTR_PARTITION,
            height: _payload.endBlock,
          })
        )
        .where({
          job_name: BULL_JOB_NAME.JOB_CREATE_EVENT_ATTR_PARTITION,
        });
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CHECK_NEED_CREATE_EVENT_ATTR_PARTITION,
    jobName: BULL_JOB_NAME.JOB_CHECK_NEED_CREATE_EVENT_ATTR_PARTITION,
  })
  async jobCheckIfNeedCreateEventAttrPartition() {
    const [blockHeightCrawledCheckpoint, eventAttrPartitionCheckpoint] =
      await Promise.all([
        BlockCheckpoint.query().findOne({
          job_name: BULL_JOB_NAME.CRAWL_BLOCK,
        }),
        BlockCheckpoint.query().findOne({
          job_name: BULL_JOB_NAME.JOB_CREATE_EVENT_ATTR_PARTITION,
        }),
      ]);

    if (blockHeightCrawledCheckpoint && eventAttrPartitionCheckpoint) {
      if (
        blockHeightCrawledCheckpoint.height +
          config.jobCheckNeedCreateEventAttributePartition.range >=
        eventAttrPartitionCheckpoint.height
      ) {
        this.logger.info('creating job create event attribute partition');
        this.createJob(
          BULL_JOB_NAME.JOB_CREATE_EVENT_ATTR_PARTITION,
          BULL_JOB_NAME.JOB_CREATE_EVENT_ATTR_PARTITION,
          {
            startBlock: eventAttrPartitionCheckpoint.height,
            endBlock:
              eventAttrPartitionCheckpoint.height +
              config.jobCheckNeedCreateEventAttributePartition.step,
          },
          {
            removeOnComplete: true,
            attempts: config.jobRetryAttempt,
            backoff: config.jobRetryBackoff,
          }
        );
      }
    }
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.JOB_CHECK_NEED_CREATE_EVENT_ATTR_PARTITION,
      BULL_JOB_NAME.JOB_CHECK_NEED_CREATE_EVENT_ATTR_PARTITION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every:
            config.jobCheckNeedCreateEventAttributePartition.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
