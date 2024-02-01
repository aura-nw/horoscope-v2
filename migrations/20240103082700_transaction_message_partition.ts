import { Knex } from 'knex';
import config from '../config.json' assert { type: 'json' };

export async function up(knex: Knex): Promise<void> {
  console.log('Migrating transaction_message to use partition');
  await knex.transaction(async (trx) => {
    await knex
      .raw(
        `set statement_timeout to ${config.migrationTransactionMessageToPartition.statementTimeout}`
      )
      .transacting(trx);
    await knex.raw(
      `CREATE TABLE transaction_message_partition (
        id SERIAL PRIMARY KEY,
        tx_id INTEGER NOT NULL,
        index INTEGER NOT NULL,
        type VARCHAR(255) NOT NULL,
        sender VARCHAR(255) NOT NULL,
        content JSONB,
        parent_id INTEGER
      ) PARTITION BY RANGE (id);
      CREATE INDEX transaction_message_partition_parent_id_index ON transaction_message_partition(parent_id);
      CREATE INDEX transaction_message_partition_sender_index ON transaction_message_partition(sender);
      CREATE INDEX transaction_message_partition_tx_id_index ON transaction_message_partition(tx_id);
      CREATE INDEX transaction_message_partition_type_index ON transaction_message_partition(type);`
    );
    let startId = config.migrationTransactionMessageToPartition.startId;
    let endId = config.migrationTransactionMessageToPartition.endId;

    await knex.schema.renameTable(
      'transaction_message',
      `transaction_message_partition_0_${startId}`
    );
    await knex.schema.renameTable(
      'transaction_message_partition',
      'transaction_message'
    );
    const oldSeqTransactionMessage = await knex.raw(
      `SELECT last_value FROM transaction_message_id_seq;`
    );
    const oldSeqValue = oldSeqTransactionMessage.rows[0].last_value;
    await knex
      .raw(
        `ALTER SEQUENCE transaction_message_partition_id_seq RESTART WITH ${oldSeqValue};`
      )
      .transacting(trx);

    // add old table transaction into transaction partitioned
    await knex
      .raw(
        `ALTER TABLE transaction_message ATTACH PARTITION transaction_message_partition_0_${startId} FOR VALUES FROM (0) TO (${startId})`
      )
      .transacting(trx);

    const step = config.migrationTransactionMessageToPartition.step;
    for (let i = startId; i < endId; i += step) {
      const partitionName = `transaction_message_partition_${i}_${i + step}`;
      await knex
        .raw(
          `CREATE TABLE ${partitionName} (LIKE transaction_message INCLUDING ALL)`
        )
        .transacting(trx);
      await knex
        .raw(
          `ALTER TABLE transaction_message ATTACH PARTITION ${partitionName} FOR VALUES FROM (${i}) TO (${
            i + step
          })`
        )
        .transacting(trx);
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    let startId = config.migrationTransactionMessageToPartition.startId;
    await knex
      .raw(
        `ALTER TABLE transaction_message DETACH PARTITION transaction_message_partition_0_${startId};`
      )
      .transacting(trx);
    await knex.schema.dropTableIfExists('transaction_message_partition');
    await knex.schema.renameTable(
      'transaction_message',
      'transaction_message_partition'
    );
    await knex.schema.renameTable(
      `transaction_message_partition_0_${startId}`,
      'transaction_message'
    );
    const oldSeqTransactionMessage = await knex.raw(
      `SELECT last_value FROM transaction_message_partition_id_seq;`
    );
    const oldSeqValue = oldSeqTransactionMessage.rows[0].last_value;
    await knex
      .raw(
        `ALTER SEQUENCE transaction_message_id_seq RESTART WITH ${oldSeqValue};`
      )
      .transacting(trx);
  });
}
