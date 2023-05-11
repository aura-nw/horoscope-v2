import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction_message', (table) => {
    table.integer('parent_id').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction_message', (table) => {
    table.dropColumn('parent_id');
  });
}
