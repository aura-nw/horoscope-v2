import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('block', (table) => {
    table.integer('tx_count');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('block', (table) => {
    table.dropColumn('tx_count');
  });
}
