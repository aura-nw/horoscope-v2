import { Knex } from 'knex';
import { EVMTransaction } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EVMTransaction.tableName, (table) => {
    table.decimal('l1_fee', 80, 0);
    table.integer('l1_fee_scalar');
    table.decimal('l1_gas_price', 80, 0);
    table.decimal('l1_gas_used', 80, 0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EVMTransaction.tableName, (table) => {
    table.dropColumns('l1_fee', 'l1_fee_scalar', 'l1_gas_price', 'l1_gas_used');
  });
}
