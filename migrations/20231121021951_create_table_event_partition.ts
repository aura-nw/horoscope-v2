import { Knex } from 'knex';
import config from '../config.json' assert { type: 'json' };
import { BULL_JOB_NAME } from '../src/common';
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    /**
     * @description: Create event table with config support partition on id column
     */
    await knex.raw(
      `CREATE TABLE IF NOT EXISTS event_partition
      (
        id bigserial NOT NULL CONSTRAINT event_partition_pvk PRIMARY KEY,
        tx_id INTEGER CONSTRAINT event_partition_transaction_foreign REFERENCES TRANSACTION,
        tx_msg_index INTEGER,
        type VARCHAR(255) NOT NULL,
        block_height INTEGER CONSTRAINT event_partition_block_foreign REFERENCES block,
        source VARCHAR(255)
      ) PARTITION BY RANGE(id);

      CREATE INDEX event_partition_type_idx
        ON event_partition (type);

      CREATE INDEX event_partition_tx_id_brin_idx
        ON event_partition USING BRIN (tx_id);

      CREATE INDEX event_partition_block_height_brin_idx
        ON event_partition USING BRIN (block_height);`
    );

    /**
     * @description: Update new table name(event_partition) to event name
     */
    await knex
      .raw('alter table event rename to event_backup;')
      .transacting(trx);
    await knex
      .raw('alter table event_partition rename to event;')
      .transacting(trx);

    /**
     * @description: Create partition base on id column and range value by step
     * Then apply partition to table
     */
    let startId = config.migrationEventToPartition.startId;
    const endId = config.migrationEventToPartition.endId;
    const step = config.migrationEventToPartition.step;
    for (let i = startId; i < endId; i += step) {
      const partitionName = `event_partition_${i}_${i + step}`;
      await knex
        .raw(`create table ${partitionName} (like event including all)`)
        .transacting(trx);
      await knex
        .raw(
          `alter table event attach partition ${partitionName} for values from (${i}) to (${
            i + step
          })`
        )
        .transacting(trx);
    }

    /**
     * @description: Check point last value of partition
     */
    await knex.raw(
      `insert into block_checkpoint(job_name, height) values ('${BULL_JOB_NAME.JOB_CREATE_EVENT_PARTITION}', ${endId})`
    );

    /**
     * @description: Copy data from old table to new
     */
    let done = false;
    while (!done) {
      console.log(`Latest id migrated: ${startId}`);
      const events = await knex('event_backup')
        .select('*')
        .where('id', '>', startId)
        .orderBy('id', 'ASC')
        .limit(config.migrationEventToPartition.limitRecordGet);

      if (events.length === 0) {
        done = true;
        break;
      }

      await knex
        .batchInsert(
          'event',
          events,
          config.migrationEventToPartition.chunkSizeInsert
        )
        .transacting(trx);
      startId = events[events.length - 1].id;
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await knex
      .raw('alter table event rename to event_partition;')
      .transacting(trx);
    await knex
      .raw('alter table event_backup rename to event;')
      .transacting(trx);
    await knex.schema.dropTableIfExists('event_partition');
  });
}
