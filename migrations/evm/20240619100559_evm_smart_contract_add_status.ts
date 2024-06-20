import { Knex } from 'knex';
import { EVMSmartContract } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EVMSmartContract.tableName, (table) => {
    table.string('status').defaultTo(EVMSmartContract.STATUS.CREATED);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EVMSmartContract.tableName, (table) => {
    table.dropColumn('status');
  });
}
