import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.integer('index');
    table.index(['height', 'index']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.dropIndex(['height', 'index']);
    table.dropColumn('index');
  });
}
