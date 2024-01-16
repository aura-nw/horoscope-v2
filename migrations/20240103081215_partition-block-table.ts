import { Knex } from 'knex';
import config from '../config.json' assert { type: 'json' };

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Create event table with config support partition on block height column
    await knex.raw(`
      CREATE TABLE block_partition
      (
          height INTEGER NOT NULL PRIMARY KEY,
          hash VARCHAR(255) NOT NULL,
          time TIMESTAMP WITH TIME ZONE NOT NULL,
          proposer_address VARCHAR(255) NOT NULL,
          data jsonb,
          CONSTRAINT block_partition_hash_unique UNIQUE (height, hash)
      ) PARTITION BY RANGE(height);

      CREATE INDEX block_partition_proposer_address_index
      ON block_partition (proposer_address);

      CREATE INDEX block_partition_time_index
      ON block_partition (time);
    `);

    // Update new table name(event_partition) to event name
    await knex
      .raw('ALTER TABLE block RENAME TO block_partition_0_100000000;')
      .transacting(trx);
    await knex
      .raw('ALTER TABLE block_partition RENAME TO block;')
      .transacting(trx);

    // Drop fk on old table and create again fk point to new block partitioned table
    await knex
      .raw(
        `
        ALTER TABLE block_signature DROP CONSTRAINT block_signature_height_foreign;
--         ALTER TABLE event DROP CONSTRAINT event_partition_block_foreign;
--         ALTER TABLE event_attribute DROP CONSTRAINT event_attribute_partition_block_height_foreign;
--         ALTER TABLE transaction DROP CONSTRAINT transaction_height_foreign;
      `
      )
      .transacting(trx);

    // add old table block into block partitioned
    await knex
      .raw(
        `ALTER TABLE block ATTACH PARTITION block_partition_0_100000000 FOR VALUES FROM (0) TO (100000000)`
      )
      .transacting(trx);
    /**
     * @description: Create partition base on id column and range value by step
     * Then apply partition to table
     */
    let startId = config.migrationBlockToPartition.startId;
    let endId = config.migrationBlockToPartition.endId;
    const step = config.migrationBlockToPartition.step;
    for (let i = startId; i < endId; i += step) {
      const partitionName = `block_partition_${i}_${i + step}`;
      await knex
        .raw(`CREATE TABLE ${partitionName} (LIKE block INCLUDING ALL)`)
        .transacting(trx);
      await knex
        .raw(
          `ALTER TABLE block ATTACH PARTITION ${partitionName} FOR VALUES FROM (${i}) TO (${
            i + step
          })`
        )
        .transacting(trx);
    }
  });
}

export async function down(knex: Knex): Promise<void> {}
