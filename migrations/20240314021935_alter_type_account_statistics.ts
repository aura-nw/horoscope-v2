import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account_statistics', (table) => {
    table.decimal('amount_sent', 80, 0).alter();
    table.decimal('amount_received', 80, 0).alter();
    table.decimal('gas_used', 80, 0).alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account_statistics', (table) => {
    table.bigint('amount_sent').alter();
    table.bigint('amount_received').alter();
    table.bigint('gas_used').alter();
  });
}
