import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('block', (table) => {
    table.setNullable('data');
  });
  await knex.schema.alterTable('transaction', (table) => {
    table.setNullable('data');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('block', (table) => {
    table.dropNullable('data');
  });
  await knex.schema.alterTable('transaction', (table) => {
    table.dropNullable('data');
  });
}
