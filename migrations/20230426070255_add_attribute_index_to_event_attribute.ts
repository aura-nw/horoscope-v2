import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event_attribute', (table) => {
    table.integer('index').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropViewIfExists('view_event_attribute_value_index');
  await knex.schema.alterTable('event_attribute', (table) => {
    table.dropColumn('index');
  });
  await knex.schema.createView(
    'view_event_attribute_value_index',
    (viewBuilder) => {
      viewBuilder.as(
        knex('event_attribute').select('*').whereRaw('length(value) <= 100')
      );
    }
  );
}
