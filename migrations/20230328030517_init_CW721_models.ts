import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('CW721_contract', (table) => {
    table.increments('id').primary();
    table.string('code_id').index().notNullable();
    table.string('address').unique().index().notNullable();
    table.string('name').index().notNullable();
    table.string('symbol');
    table.string('minter');
    table.string('creator');
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });

  await knex.schema.createTable('CW721_token', (table) => {
    table.increments('id').primary();
    table.string('token_id').index().notNullable();
    table.string('token_uri');
    table.jsonb('extension');
    table.string('owner');
    table
      .string('contract_address')
      .index()
      .notNullable()
      .references('CW721_contract.address');
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });

  await knex.schema.createTable('CW721_tx', (table) => {
    table.increments('id').primary();
    table.string('txhash').unique().index().notNullable();
    table.string('from').index();
    table.string('to').index();
    table.string('action');
    table
      .string('contract_address')
      .index()
      .notNullable()
      .references('CW721_contract.address');
    table
      .string('token_id')
      .index()
      .notNullable()
      .references('CW721_token.token_id');
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('cw20_holder');
}
