import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('daily_statistics', (table: any) => {
    table.increments();
    table.bigint('daily_txs').index().notNullable();
    table.bigint('daily_active_addresses').index().notNullable();
    table.bigint('unique_addresses').index().notNullable();
    table.bigint('unique_addresses_increase').index().notNullable();
    table.timestamp('date').unique().notNullable();
  });
  await knex.schema.createTable('account_statistics', (table: any) => {
    table.increments();
    table.string('address').index().notNullable();
    table.bigint('amount_sent').index().notNullable();
    table.bigint('amount_received').index().notNullable();
    table.bigint('tx_sent').index().notNullable();
    table.bigint('gas_used').index().notNullable();
    table.timestamp('date').index().notNullable();
    table.unique(['address', 'date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('account_statistics');
  await knex.schema.dropTable('daily_statistics');
}
