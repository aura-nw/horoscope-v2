import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_proxy_history', (table) => {
    table.dropIndex('proxy_contract');
    table.unique(['proxy_contract', 'block_height']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_proxy_history', (table) => {
    table.dropIndex(['proxy_contract', 'block_height']);
    table.index('proxy_contract');
  });
}
