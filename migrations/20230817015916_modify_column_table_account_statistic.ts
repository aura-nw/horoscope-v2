import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account_statistics', (table) => {
    table.dropIndex('amount_sent');
    table.dropIndex('amount_received');
    table.dropIndex('tx_sent');
    table.dropIndex('gas_used');
    table.integer('tx_sent').alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account_statistics', (table) => {
    table.index('amount_sent');
    table.index('amount_received');
    table.index('tx_sent');
    table.index('gas_used');
    table.bigint('tx_sent').alter();
  });
}
