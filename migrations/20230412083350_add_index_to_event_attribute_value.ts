import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event_attribute', (table) => {
    table.index('value');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event_attribute', (table) => {
    table.dropIndex('value');
  });
}
