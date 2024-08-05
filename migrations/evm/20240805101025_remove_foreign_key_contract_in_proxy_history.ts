import { Knex } from 'knex';
import { EvmProxyHistory } from '../../src/models/evm_proxy_history';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EvmProxyHistory.tableName, (table) => {
    table.dropForeign('proxy_contract');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(EvmProxyHistory.tableName, (table) => {
    table
      .foreign('proxy_contract')
      .references('address')
      .inTable('evm_smart_contract');
  });
}
