import { Knex } from 'knex';
import { SmartContract } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('smart_contract', (table) => {
    table.dropUnique(['address']);
    table.index(['address']);
    table.unique(['address', 'code_id']);
    table
      .string('status')
      .index()
      .defaultTo(SmartContract.STATUS.LATEST)
      .notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('smart_contract', (table) => {
    table.dropColumn('status');
    table.dropUnique(['address', 'code_id']);
    table.dropIndex(['address']);
    table.unique(['address']);
  });
}
