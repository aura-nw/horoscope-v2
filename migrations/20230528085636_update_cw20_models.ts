import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cw20_contract', (table) => {
    table.increments('id').primary();
    table.integer('smart_contract_id').unique().notNullable();
    table.jsonb('marketing_info');
    table.decimal('total_supply', 80, 0);
    table.string('symbol').index();
    table.string('minter').index();
    table.string('name').index();
    table.foreign('smart_contract_id').references('smart_contract.id');
  });
  await knex.schema.createTable('cw20_holder', (table) => {
    table.increments('id').primary();
    table.integer('cw20_contract_id').index().notNullable();
    table.string('address').notNullable().index();
    table.decimal('amount', 80, 0);
    table.integer('last_updated_height').index();
    table.foreign('cw20_contract_id').references('cw20_contract.id');
  });
  await knex.schema.createTable('cw20_activity', (table) => {
    table.increments('id').primary();
    table.integer('cw20_contract_id').index().notNullable();
    table.integer('smart_contract_event_id').index().notNullable();
    table.string('action');
    table.string('sender').index();
    table.string('from');
    table.string('to');
    table.integer('height').index();
    table.decimal('amount', 80, 0);
    table.foreign('cw20_contract_id').references('cw20_contract.id');
    table
      .foreign('smart_contract_event_id')
      .references('smart_contract_event.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('cw20_activity');
  await knex.schema.dropTable('cw20_holder');
  await knex.schema.dropTable('cw20_contract');
}
