import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_proxy_history', (table) => {
    table
      .foreign('proxy_contract')
      .references('address')
      .inTable('evm_smart_contract');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_proxy_history', (table) => {
    table.dropForeign('proxy_contract');
  });
}
