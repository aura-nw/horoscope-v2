import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_contract_verification', (table) => {
    table.jsonb('compile_detail');
    table.string('compiler_version');
    table.string('contract_name');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_contract_verification', (table) => {
    table.dropColumn('compile_detail');
    table.dropColumn('compiler_version');
    table.dropColumn('contract_name');
  });
}
