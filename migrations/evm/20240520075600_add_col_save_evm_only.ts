import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.decimal('gas_used', 80, 0);
    table.decimal('gas_price', 80, 0);
    table.decimal('gas_limit', 80, 0);
    table.integer('type').index();
  });
  await knex.schema.alterTable('evm_event', (table) => {
    table.integer('tx_id').nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('evm_transaction', (table) => {
    table.dropColumns('gas_used', 'gas_price', 'gas_limit', 'type');
    table.integer('tx_id').notNullable().alter();
  });
  await knex.schema.alterTable('evm_event', (table) => {
    table.integer('tx_id').notNullable().alter();
  });
}
