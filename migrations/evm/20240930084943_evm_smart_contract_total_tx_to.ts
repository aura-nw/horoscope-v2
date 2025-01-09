import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_smart_contract', (table) => {
    table.integer('total_tx_to').defaultTo(0).index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_smart_contract', (table) => {
    table.dropColumn('total_tx_to');
  });
}
