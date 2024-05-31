import { Knex } from 'knex';
import { EvmInternalTransaction } from '../src/models/evm_internal_transaction';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(EvmInternalTransaction.tableName, (table) => {
    table.increments();
    table.string('evm_tx_id').index().notNullable();
    table.string('type_trace_address').notNullable();
    table.string('type').notNullable();
    table.string('from').notNullable();
    table.string('to').notNullable();
    table.bigint('value').notNullable();
    table.string('input').notNullable();
    table.bigint('gas').notNullable();
    table.bigint('gas_used').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {}
