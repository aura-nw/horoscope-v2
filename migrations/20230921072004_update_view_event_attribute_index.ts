import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await knex.schema
      .createViewOrReplace(
        'view_event_attribute_value_index',
        (viewBuilder) => {
          viewBuilder.as(
            knex('event_attribute')
              .select('*')
              .whereRaw('length(value) >= 40 AND length(value) <= 75')
          );
        }
      )
      .transacting(trx);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await knex.schema
      .createViewOrReplace(
        'view_event_attribute_value_index',
        (viewBuilder) => {
          viewBuilder.as(
            knex('event_attribute').select('*').whereRaw('length(value) <= 100')
          );
        }
      )
      .transacting(trx);
  });
}
