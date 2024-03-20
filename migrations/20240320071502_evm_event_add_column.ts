import { Knex } from 'knex';
import { EvmEvent } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EvmEvent.tableName, (table) => {
    table.binary('data');
  });
}

export async function down(knex: Knex): Promise<void> {}
