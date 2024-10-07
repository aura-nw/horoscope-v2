import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`set statement_timeout to 0`);
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.integer('from_account_id').index();
    table.integer('to_account_id').index();
    table.index(['to_account_id', 'id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.dropColumns('from_account_id', 'to_account_id');
  });
}
