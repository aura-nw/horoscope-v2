import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_block', (table) => {
    table.renameColumn('date', 'timestamp');
  });
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.timestamp('timstamp').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.dropColumn('timstamp');
  });
}
