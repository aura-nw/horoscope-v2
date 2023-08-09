import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('block', (table) => {
    table.index('time');
  });
  await knex.schema.alterTable('transaction', (table) => {
    table.index('timestamp');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('block', (table) => {
    table.dropIndex('time');
  });
  await knex.schema.alterTable('transaction', (table) => {
    table.dropIndex('timestamp');
  });
}
