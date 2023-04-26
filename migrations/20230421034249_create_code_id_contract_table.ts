import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('code', (table: any) => {
    table.integer('code_id').primary();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.string('creator').index().notNullable();
    table.string('data_hash').index().notNullable();
    table.jsonb('instantiate_permission').notNullable();
    table.string('type').index();
    table.string('status').index();
    table.string('store_hash').index().notNullable();
    table.integer('store_height').index().notNullable();
  });
  await knex.schema.createTable('smart_contract', (table: any) => {
    table.increments();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.string('name').index();
    table.string('address').unique().notNullable();
    table.string('creator').index().notNullable();
    table.integer('code_id').index().notNullable();
    table.string('instantiate_hash').index().notNullable();
    table.integer('instantiate_height').index().notNullable();
    table.string('version').index();
    table.foreign('code_id').references('code.code_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('smart_contract');
  await knex.schema.dropTable('code_id');
}
