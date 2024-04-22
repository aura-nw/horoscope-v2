import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.integer('status').index();
    table.text('reason');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.dropColumns('status', 'reason');
  });
}
