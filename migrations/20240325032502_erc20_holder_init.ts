import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('erc20_holder', (table) => {
    table.increments();
    table.string('address').notNullable().index();
    table.decimal('balance', 80, 0).notNullable();
    table.string('erc20_contract_address').notNullable().index();
    table
      .foreign('erc20_contract_address')
      .references('erc20_contract.address');
    table.index(['address', 'erc20_contract_address']);
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('erc20_holder');
}
