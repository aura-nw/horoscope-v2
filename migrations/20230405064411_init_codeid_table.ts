import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('code_id', (table) => {
    table.increments('id').primary();
    table.string('code_id').unique().index().notNullable();
    table.string('type').index().notNullable();
    table.string('status').index().notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('code_id');
}
