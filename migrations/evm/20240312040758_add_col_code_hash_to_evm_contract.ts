import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_smart_contract', (table) => {
    table.string('code_hash').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_smart_contract', (table) => {
    table.dropColumns('code_hash');
  });
}
