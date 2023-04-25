import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
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
}
