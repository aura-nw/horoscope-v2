import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    'CREATE INDEX event_attribute_value_index ON event_attribute(value) WHERE length(value) <= 100;'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event_attribute', (table) => {
    table.dropIndex('value');
  });
}
