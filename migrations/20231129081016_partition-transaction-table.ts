import { Knex } from 'knex';
import config from '../config.json' assert { type: 'json' };

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    /**
     * @description: Create event table with config support partition on block height column
     */
    await knex.raw(`
      CREATE TABLE transaction_partition
      (
        id SERIAL PRIMARY KEY,
        height INTEGER NOT NULL CONSTRAINT transaction_height_foreign
            REFERENCES block,
        hash VARCHAR(255) NOT NULL,
        codespace  VARCHAR(255) NOT NULL,
        code INTEGER NOT NULL,
        gas_used BIGINT NOT NULL,
        gas_wanted BIGINT NOT NULL,
        gas_limit BIGINT NOT NULL,
        fee JSONB NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        data JSONB,
        memo TEXT,
        index INTEGER
      ) PARTITION BY RANGE(id);
      CREATE INDEX transaction_partition_height_index
      ON transaction_partition (height);
      CREATE INDEX transaction_partition_index_index
      ON transaction_partition (index);
      CREATE INDEX transaction_partition_hash_index
        ON transaction_partition (hash);
      CREATE INDEX transaction_partition_timestamp_index
        ON transaction_partition (timestamp);
    `);

    /**
     * @description: Update new table name(event_partition) to event name
     */
    await knex
      .raw(
        'ALTER TABLE transaction RENAME TO transaction_partition_0_100000000;'
      )
      .transacting(trx);
    await knex
      .raw('ALTER TABLE transaction_partition RENAME TO transaction;')
      .transacting(trx);

    /**
     * @description: Drop fk on old table and create again fk point to new transaction partitioned table
     */
    await knex
      .raw(
        `
        ALTER TABLE transaction_message
        DROP CONSTRAINT transaction_message_tx_id_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE transaction_message
        ADD CONSTRAINT transaction_message_tx_id_foreign FOREIGN KEY (tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE event DROP CONSTRAINT event_partition_transaction_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE event ADD CONSTRAINT event_partition_transaction_foreign FOREIGN KEY (tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE event_attribute DROP CONSTRAINT event_attribute_partition_tx_id_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE event_attribute ADD CONSTRAINT event_attribute_partition_tx_id_foreign FOREIGN KEY (tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE event_attribute ADD CONSTRAINT event_attribute_partition_event_id_foreign FOREIGN KEY (event_id) REFERENCES event(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE smart_contract_event ADD CONSTRAINT smart_contract_event_event_id_foreign FOREIGN KEY (event_id) REFERENCES event(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE vote DROP CONSTRAINT vote_tx_id_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE vote ADD CONSTRAINT vote_tx_id_foreign FOREIGN KEY (tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE power_event DROP CONSTRAINT power_event_tx_id_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE power_event ADD CONSTRAINT power_event_tx_id_foreign FOREIGN KEY (tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE feegrant_history DROP CONSTRAINT feegrant_history_tx_id_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE feegrant_history ADD CONSTRAINT feegrant_history_tx_id_foreign FOREIGN KEY (tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE feegrant DROP CONSTRAINT feegrant_init_tx_id_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE feegrant ADD CONSTRAINT feegrant_init_tx_id_foreign FOREIGN KEY (init_tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    /**
     * @description add old table transaction into transaction partitioned
     */
    await knex
      .raw(
        `ALTER TABLE transaction ATTACH PARTITION transaction_partition_0_100000000 FOR VALUES FROM (0) TO (100000000)`
      )
      .transacting(trx);
    /**
     * @description: Create partition base on id column and range value by step
     * Then apply partition to table
     */
    let startId = config.migrationTransactionToPartition.startId;
    let endId = config.migrationTransactionToPartition.endId;
    const step = config.migrationTransactionToPartition.step;
    for (let i = startId; i < endId; i += step) {
      const partitionName = `transaction_partition_${i}_${i + step}`;
      await knex
        .raw(`CREATE TABLE ${partitionName} (LIKE transaction INCLUDING ALL)`)
        .transacting(trx);
      await knex
        .raw(
          `ALTER TABLE transaction ATTACH PARTITION ${partitionName} FOR VALUES FROM (${i}) TO (${
            i + step
          })`
        )
        .transacting(trx);
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await knex
      .raw(
        `
        ALTER TABLE transaction DETACH PARTITION transaction_partition_0_100000000;
      `
      )
      .transacting(trx);
    await knex
      .raw('alter table transaction rename to transaction_partition;')
      .transacting(trx);
    await knex
      .raw(
        'alter table transaction_partition_0_100000000 rename to transaction;'
      )
      .transacting(trx);
    await knex.schema.dropTableIfExists('transaction_partition');
    await knex
      .raw(
        `
        ALTER TABLE transaction_message
        DROP CONSTRAINT transaction_message_tx_id_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE transaction_message
        ADD CONSTRAINT transaction_message_tx_id_foreign FOREIGN KEY (tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE event DROP CONSTRAINT event_partition_transaction_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE event ADD CONSTRAINT event_partition_transaction_foreign FOREIGN KEY (tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE event_attribute DROP CONSTRAINT event_attribute_partition_tx_id_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE event_attribute ADD CONSTRAINT event_attribute_partition_tx_id_foreign FOREIGN KEY (tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE vote DROP CONSTRAINT vote_tx_id_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE vote ADD CONSTRAINT vote_tx_id_foreign FOREIGN KEY (tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE power_event DROP CONSTRAINT power_event_tx_id_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE power_event ADD CONSTRAINT power_event_tx_id_foreign FOREIGN KEY (tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE feegrant_history DROP CONSTRAINT feegrant_history_tx_id_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE feegrant_history ADD CONSTRAINT feegrant_history_tx_id_foreign FOREIGN KEY (tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE feegrant DROP CONSTRAINT feegrant_init_tx_id_foreign;
    `
      )
      .transacting(trx);
    await knex
      .raw(
        `
        ALTER TABLE feegrant ADD CONSTRAINT feegrant_init_tx_id_foreign FOREIGN KEY (init_tx_id) REFERENCES transaction(id);
    `
      )
      .transacting(trx);
  });
}
