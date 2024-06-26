import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.timestamp('date').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.dropColumn('date');
  });
}
