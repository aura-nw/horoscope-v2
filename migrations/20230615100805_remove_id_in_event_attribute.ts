import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropView('view_event_attribute_value_index');
  await knex.schema.table('event_attribute', (table) => {
    table.dropColumn('id');
    table.primary(['event_id', 'index'], {
      constraintName: 'event_attribute_pk',
    });
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

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropView('view_event_attribute_value_index');
  await knex.schema.alterTable('event_attribute', (table) => {
    table.dropPrimary('event_attribute_pk');
    table.integer('id').primary({ constraintName: 'event_attribute_pk' });
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
