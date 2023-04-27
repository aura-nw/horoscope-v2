import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event_attribute', (table) => {
    table.integer('index').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event_attribute', (table) => {
    table.dropColumn('index');
  });
}
