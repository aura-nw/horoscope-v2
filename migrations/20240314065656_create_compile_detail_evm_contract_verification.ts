import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_contract_verification', (table) => {
    table.jsonb('compile_detail');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_contract_verification', (table) => {
    table.dropColumn('compile_detail');
  });
}
