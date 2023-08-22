import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account_statistics', (table) => {
    table.integer('tx_sent').alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account_statistics', (table) => {
    table.bigint('tx_sent').alter();
  });
}
