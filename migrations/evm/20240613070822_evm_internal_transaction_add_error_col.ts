import { Knex } from 'knex';
import { EvmInternalTransaction } from '../../src/models/evm_internal_transaction';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EvmInternalTransaction.tableName, (table) => {
    table.string('error');
    table.dropNullable('from');
    table.dropNullable('to');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EvmInternalTransaction.tableName, (table) => {
    table.dropColumn('error');
  });
}
