import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_contract_verification', (table) => {
    table.jsonb('compiler_setting');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_contract_verification', (table) => {
    table.dropColumn('compiler_setting');
  });
}
