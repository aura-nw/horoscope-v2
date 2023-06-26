import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await knex.schema
      .alterTable('event', (table) => {
        table.bigint('id').alter({ alterType: true, alterNullable: false });
      })
      .transacting(trx);
    await knex
      .raw('alter sequence if exists transaction_event_id_seq as bigint')
      .transacting(trx);

    await knex.schema
      .dropViewIfExists('view_event_attribute_value_index')
      .transacting(trx);

    await knex.schema
      .alterTable('event_attribute', (table) => {
        table
          .bigint('event_id')
          .alter({ alterType: true, alterNullable: false });
      })
      .transacting(trx);

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

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await knex.schema
      .dropViewIfExists('view_event_attribute_value_index')
      .transacting(trx);
    await knex.schema
      .alterTable('event_attribute', (table) => {
        table
          .integer('event_id')
          .alter({ alterType: true, alterNullable: false });
      })
      .transacting(trx);
    await knex.schema
      .alterTable('event', (table) => {
        table.integer('id').alter({ alterType: true, alterNullable: false });
      })
      .transacting(trx);
    await knex
      .raw('alter sequence if exists transaction_event_id_seq as integer')
      .transacting(trx);
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
