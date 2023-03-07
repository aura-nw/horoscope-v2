import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('cw20_holder', (table) => {
    table.increments();
    table.string('address').notNullable().index();
    table.decimal('balance', 80, 0).notNullable();
    table.string('contract_address').notNullable().index();
    table.foreign('contract_address').references('cw20_token.contract_address');
    table.index(['address', 'contract_address']);
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('cw20_holder');
}
