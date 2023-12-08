import { Knex } from 'knex';
import config from '../config.json' assert { type: 'json' };

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
      `
    );

    /**
     * @description: Update new table name(event_partition) to event name
     */
    await knex
      .raw('ALTER TABLE event RENAME TO event_backup;')
      .transacting(trx);
    await knex
      .raw('ALTER TABLE event_partition RENAME TO event;')
      .transacting(trx);

    /**
     * @description: Create partition base on id column and range value by step
     * Then apply partition to table
     */
    let startId = config.migrationEventToPartition.startId;
    const latestEvent = await knex('event_backup')
      .orderBy('id', 'DESC')
      .first();
    const endId = latestEvent
      ? Number(latestEvent.id)
      : config.migrationEventToPartition.endId;
    const step = config.migrationEventToPartition.step;
    for (let i = startId; i < endId; i += step) {
      const partitionName = `event_partition_${i}_${i + step}`;
      await knex
        .raw(`CREATE TABLE ${partitionName} (LIKE event INCLUDING ALL)`)
        .transacting(trx);
      await knex
        .raw(
          `ALTER TABLE event ATTACH PARTITION ${partitionName} FOR VALUES FROM (${i}) TO (${
            i + step
          })`
        )
        .transacting(trx);
    }

    /**
     * @description: Copy data from old table to new
     */
    let done = false;
    while (!done) {
      console.log(`Latest id migrated: ${startId}`);
      const events = await knex('event_backup')
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
    const currentEventIdSeq = await knex.raw(`
      SELECT last_value FROM transaction_event_id_seq;
    `);
    const lastEventId = currentEventIdSeq.rows[0].last_value;
    await knex
      .raw(
        `
      SELECT setval('event_partition_id_seq', ${lastEventId}, true);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
      CREATE INDEX event_partition_tx_id_btree_idx
      ON event USING BTREE (tx_id ASC NULLS LAST);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
      CREATE INDEX event_partition_block_height_btree_idx
      ON event USING BTREE (block_height ASC NULLS LAST);
    `
      )
      .transacting(trx);
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
