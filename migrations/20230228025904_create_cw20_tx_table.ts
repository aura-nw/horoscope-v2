import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('cw20_tx', (table) => {
    table.increments();
    table.string('txhash').notNullable().index();
    table.string('from').index();
    table.string('to').index();
    table.decimal('amount', 80, 0);
    table.string('action');
    table.string('contract_address').notNullable().index();
    table.foreign('contract_address').references('cw20_token.contract_address');
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('cw20_tx');
}
