import { Knex } from 'knex';
import { PowerEvent } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('power_event', (table) => {
    table.string('type').index().notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('power_event', (table) => {
    table
      .enum('type', [
        PowerEvent.TYPES.DELEGATE,
        PowerEvent.TYPES.REDELEGATE,
        PowerEvent.TYPES.UNBOND,
      ])
      .index()
      .notNullable()
      .alter();
  });
}
