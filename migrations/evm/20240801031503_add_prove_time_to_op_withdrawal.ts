import { Knex } from 'knex';
import { OptimismWithdrawal } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(OptimismWithdrawal.tableName, (table) => {
    table.timestamp('prove_time');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(OptimismWithdrawal.tableName, (table) => {
    table.dropColumn('prove_time');
  });
}
