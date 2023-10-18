import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction', (table) => {
    table.index('height', 'brin_idx_height_transaction', 'brin');
    table.index('timestamp', 'brin_idx_timestamp_transaction', 'brin');
  });
  await knex.schema.alterTable('transaction', (table) => {
    table.dropIndex('height', 'transaction_height_index');
    table.dropIndex('timestamp', 'transaction_timestamp_index');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction', (table) => {
    table.index('height', 'transaction_height_index', 'btree');
    table.index('timestamp', 'transaction_timestamp_index', 'btree');
  });
  await knex.schema.alterTable('transaction', (table) => {
    table.dropIndex('height', 'brin_idx_height_transaction');
    table.dropIndex('timestamp', 'brin_idx_timestamp_transaction');
  });
}
