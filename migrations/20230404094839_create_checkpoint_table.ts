import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('checkpoint', (table) => {
    table.increments();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.string('job_name').unique().notNullable();
    table.jsonb('data');
  });
}

export async function down(knex: Knex): Promise<void> {
  knex.schema.dropTable('checkpoint');
}
