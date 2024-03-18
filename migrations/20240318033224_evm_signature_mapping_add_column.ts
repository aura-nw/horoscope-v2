import { Knex } from 'knex';
import { EvmSignatureMapping } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EvmSignatureMapping.tableName, (table) => {
    table.string('function_id', 8);
    table.index('function_id', 'idx_function_id');
  });
}

export async function down(knex: Knex): Promise<void> {}
