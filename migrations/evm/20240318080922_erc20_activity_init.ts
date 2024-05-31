import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('erc20_activity', (table) => {
    table.increments('id').primary();
    table.string('tx_hash').index();
    table.string('erc20_contract_address').index().notNullable();
    table.integer('evm_event_id').index().notNullable();
    table.string('action').index();
    table.string('sender').index();
    table.string('from').index();
    table.string('to').index();
    table.integer('height').index();
    table.decimal('amount', 80, 0);
    table
      .foreign('erc20_contract_address')
      .references('erc20_contract.address');
    table.foreign('evm_event_id').references('evm_event.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('erc20_activity');
}
