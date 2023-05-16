import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('smart_contract_event', (table) => {
    table.increments('id').primary();
    table.integer('smart_contract_id').unique().index().notNullable();
    table.string('action');
    table.integer('event_id').index().notNullable();
    table.integer('index').notNullable();
    table.foreign('smart_contract_id').references('smart_contract.id');
    table.foreign('event_id').references('event.id');
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });
  await knex.schema.createTable('smart_contract_event_attribute', (table) => {
    table.increments('id').primary();
    table.integer('smart_contract_event_id').unique().index().notNullable();
    table.string('key');
    table.string('value');
    table
      .foreign('smart_contract_event_id')
      .references('smart_contract_event.id');
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('smart_contract_event');
  await knex.schema.dropTable('smart_contract_event_attribute');
}
