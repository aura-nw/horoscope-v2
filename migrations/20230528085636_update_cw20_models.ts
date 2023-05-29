import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTable('cw20_tx');
  await knex.schema.dropTable('cw20_holder');
  await knex.schema.dropTable('cw20_token');
  await knex.schema.createTable('cw20_contract', (table) => {
    table.increments('id').primary();
    table.integer('smart_contract_id').unique().index().notNullable();
    table.jsonb('marketing_info');
    table.decimal('total_supply', 80, 0);
    table.string('symbol');
    table.string('minter');
    table.string('name');
    table.foreign('smart_contract_id').references('smart_contract.id');
  });
  await knex.schema.createTable('cw20_holder', (table) => {
    table.increments('id').primary();
    table.integer('cw20_contract_id').index().notNullable();
    table.string('address').notNullable();
    table.decimal('amount', 80, 0);
    table.foreign('cw20_contract_id').references('cw20_contract.id');
  });
  await knex.schema.createTable('cw20_activity', (table) => {
    table.increments('id').primary();
    table.integer('cw20_contract_id').index().notNullable();
    table.string('tx_hash').index().notNullable();
    table.string('action');
    table.string('sender').index();
    table.string('from');
    table.string('to');
    table.integer('height').index();
    table.decimal('amount', 80, 0);
    table.foreign('cw20_contract_id').references('cw20_contract.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.createTable('cw20_token', (table) => {
    table.increments();
    table.string('code_id').notNullable().index();
    table.string('asset_info');
    table.string('contract_address').notNullable().unique().index();
    table.string('marketing_info');
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });
  await knex.schema.createTable('cw20_holder', (table) => {
    table.increments();
    table.string('address').notNullable().index();
    table.decimal('balance', 80, 0).notNullable();
    table.string('contract_address').notNullable().index();
    table.foreign('contract_address').references('cw20_token.contract_address');
    table.index(['address', 'contract_address']);
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });
  await knex.schema.createTable('cw20_tx', (table) => {
    table.increments();
    table.string('tx_hash').notNullable().index();
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
