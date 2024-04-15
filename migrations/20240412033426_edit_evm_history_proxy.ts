import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_proxy_history', (table) => {
    table.dropColumn('admin');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_proxy_history', (table) => {
    table.string('admin');
  });
}
