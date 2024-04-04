import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_event', (table) => {
    table.index(['address', 'evm_tx_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_event', (table) => {
    table.dropIndex(['address', 'evm_tx_id']);
  });
}
