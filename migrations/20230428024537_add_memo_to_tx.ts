import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction', (table) => {
    table.string('memo');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction', (table) => {
    table.dropColumn('memo');
  });
}
