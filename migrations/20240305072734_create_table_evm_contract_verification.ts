import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('evm_contract_verification', (table) => {
    table.increments();
    table.string('contract_address').index();
    table.string('creator_tx_hash');
    table.binary('files');
    table.string('status');
    table.jsonb('abi');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('evm_contract_verification');
}
