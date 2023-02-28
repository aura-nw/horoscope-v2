import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('cw20_holders', (table) => {
    table.increments();
    table.string('address');
    table.bigInteger('balance');
    table.string('contract_address');
    table
      .foreign('contract_address')
      .references('cw20_tokens.contract_address');
    table.index(['address', 'contract_address']);
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('cw20_holders');
}
