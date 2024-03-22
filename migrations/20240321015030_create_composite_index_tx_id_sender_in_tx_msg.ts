import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction_message', (table) => {
    table.index(['sender', 'tx_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction_message', (table) => {
    table.dropIndex(['sender', 'tx_id']);
  });
}
