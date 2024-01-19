/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import { BlockCheckpoint, Event } from '../../models';

@Service({
  name: SERVICE.V1.JobService.MigrateDataEventTable.key,
  version: 1,
})
export default class MigrateDataEventTableJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  // Create and attach partition for event partition table
  public async createPartitionForEventPartition(
    startId: number,
    endId: number,
    isPartitionAlreadyCreated: boolean
  ): Promise<void> {
    if (isPartitionAlreadyCreated) return;
    const partitionValueRange = config.migrationEventToPartition.step;
    let fromValue = startId;
    const endValue = endId + partitionValueRange;
    for (fromValue; fromValue < endValue; fromValue += partitionValueRange) {
      const toValue = fromValue + partitionValueRange;
      const partitionName = `event_partition_${fromValue}_${toValue}`;
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      await knex.transaction(async (trx) => {
        await knex
          .raw(
            `CREATE TABLE ${partitionName} (LIKE event_partition INCLUDING ALL)`
          )
          .transacting(trx);
        await knex
          .raw(
            `
            ALTER TABLE event_partition
              ATTACH PARTITION ${partitionName} FOR VALUES FROM (${fromValue}) TO (${toValue})
          `
          )
          .transacting(trx);
      });
    }
  }

  // Copy data from old table to new
  public async migrateDataFromEventToEventPartition(
    startId: number
  ): Promise<void> {
    let done = false;
    let currentIdMigrated = startId;
    while (!done) {
      this.logger.info(`Latest id migrated: ${currentIdMigrated}`);
      const events = await Event.query()
        .where('id', '>', currentIdMigrated)
        .orderBy('id', 'ASC')
        .limit(config.migrationEventToPartition.limitRecordGet);

      if (events.length === 0) {
        done = true;
        break;
      }

      const trx = await knex.transaction();
      currentIdMigrated = Number(events[events.length - 1].id);

      try {
        await trx.batchInsert(
          'event_partition',
          events,
          config.migrationEventToPartition.chunkSizeInsert
        );
        await trx
          .table('block_checkpoint')
          .update({ height: currentIdMigrated })
          .where('job_name', BULL_JOB_NAME.CP_MIGRATE_DATA_EVENT_TABLE);
        await trx.commit();
      } catch (error) {
        await trx.rollback();
        this.logger.error(error);
      }
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_MIGRATE_DATA_EVENT_TABLE,
    jobName: BULL_JOB_NAME.JOB_MIGRATE_DATA_EVENT_TABLE,
  })
  public async migrateEventPartition(): Promise<void> {
    const eventPartitionCount = await knex.raw(`
      SELECT count(*) AS partition_count
      FROM pg_catalog.pg_inherits
      WHERE inhparent = 'event'::regclass;
    `);
    if (eventPartitionCount.rows[0].partition_count > 0) {
      this.logger.info('Event already partitioned');
      return;
    }
    // Checkpoint job
    const blockCheckpointMigrate = await BlockCheckpoint.query()
      .where('job_name', BULL_JOB_NAME.CP_MIGRATE_DATA_EVENT_TABLE)
      .first();
    let currentCheckPointJob: BlockCheckpoint;

    if (!blockCheckpointMigrate) {
      const newBlockCheckPoint = new BlockCheckpoint();
      newBlockCheckPoint.height = config.migrationEventToPartition.startId;
      newBlockCheckPoint.job_name = BULL_JOB_NAME.CP_MIGRATE_DATA_EVENT_TABLE;
      await BlockCheckpoint.query().insert(newBlockCheckPoint);
      currentCheckPointJob = newBlockCheckPoint;
    } else {
      currentCheckPointJob = blockCheckpointMigrate;
    }

    const currentLatestEventId = await Event.query()
      .orderBy('id', 'DESC')
      .limit(1);

    if (!currentLatestEventId) {
      this.logger.info('Error start job migrate event data', {
        currentLatestEventId,
      });
      return;
    }

    const startId = currentCheckPointJob.height;
    const endId = Number(currentLatestEventId[0].id);

    // Create partition for event_partition
    await this.createPartitionForEventPartition(
      startId,
      endId,
      !!blockCheckpointMigrate
    );
    // Copy data from old table to new
    await this.migrateDataFromEventToEventPartition(startId);
  }

  public async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.JOB_MIGRATE_DATA_EVENT_TABLE,
      BULL_JOB_NAME.JOB_MIGRATE_DATA_EVENT_TABLE,
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
