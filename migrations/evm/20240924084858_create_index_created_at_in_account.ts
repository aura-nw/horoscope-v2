import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('SET statement_timeout TO 0');
  await knex.schema.alterTable('account', (table) => {
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account', (table) => {
    table.dropIndex('created_at');
  });
}
