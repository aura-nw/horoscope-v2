import { Knex } from 'knex';
import { EvmInternalTransaction } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EvmInternalTransaction.tableName, (table) => {
    table.decimal('value', 80, 0).alter();
  });
}

export async function down(knex: Knex): Promise<void> {}
