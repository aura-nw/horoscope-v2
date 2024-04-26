import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('erc721_activity', (table) => {
    table.increments('id').primary();
    table.string('tx_hash').index();
    table.string('erc721_contract_address').index().notNullable();
    table.integer('evm_event_id').index().notNullable();
    table.string('action').index();
    table.string('sender').index();
    table.string('from').index();
    table.string('to').index();
    table.integer('height').index();
    table.integer('erc721_token_id').index();
    table.integer('evm_tx_id').index();
    table.foreign('evm_tx_id').references('evm_transaction.id');
    table
      .foreign('erc721_contract_address')
      .references('erc721_contract.address');
    table.foreign('erc721_token_id').references('erc721_token.id');
    table.foreign('evm_event_id').references('evm_event.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('erc721_activity');
}
