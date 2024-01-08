import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Create event table with config support partition on id column
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

      CREATE INDEX event_partition_tx_id_btree_idx
        ON event_partition USING BTREE (tx_id ASC NULLS LAST);

      CREATE INDEX event_partition_block_height_btree_idx
        ON event_partition USING BTREE (block_height ASC NULLS LAST);`
    );

    // Change table name if no data exist on event
    const isExistEventData = await knex.raw(`SELECT * FROM event LIMIT 1`);
    if (isExistEventData.rows.length === 0) {
      await knex
        .raw('ALTER TABLE event RENAME TO event_backup;')
        .transacting(trx);
      await knex
        .raw('ALTER TABLE event_partition RENAME TO event;')
        .transacting(trx);
    }
  });
}

export async function down(knex: Knex): Promise<void> {}
