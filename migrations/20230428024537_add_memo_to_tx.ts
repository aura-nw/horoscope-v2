import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction', (table) => {
    table.text('memo');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction', (table) => {
    table.dropColumn('memo');
  });
}
