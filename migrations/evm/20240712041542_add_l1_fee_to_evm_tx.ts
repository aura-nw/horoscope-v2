import { Knex } from 'knex';
import { EVMTransaction } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EVMTransaction.tableName, (table) => {
    table.jsonb('additional_data');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EVMTransaction.tableName, (table) => {
    table.dropColumns('additional_data');
  });
}
