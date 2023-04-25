import { Knex } from 'knex';
import { PowerEvent } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('power_event', (table) => {
    table.dropColumn('delegator_id');
  });
  await knex.raw(
    'ALTER TABLE power_event DROP CONSTRAINT power_event_type_check'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('power_event', (table) => {
    table.integer('delegator_id').index().notNullable();
  });
}
