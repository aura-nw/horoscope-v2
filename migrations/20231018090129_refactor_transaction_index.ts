import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS brin_idx_height_transaction
    ON transaction USING brin (height) WITH (PAGES_PER_RANGE = 10, AUTOSUMMARIZE = true)
  `);
  await knex.schema.alterTable('transaction', (table) => {
    // table.index('height', 'brin_idx_height_transaction', 'brin');
    table.index('timestamp', 'brin_idx_timestamp_transaction', 'brin');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction', (table) => {
    table.dropIndex('height', 'brin_idx_height_transaction');
    table.dropIndex('timestamp', 'brin_idx_timestamp_transaction');
  });
}
