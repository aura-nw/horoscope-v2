import { Knex } from 'knex';
import { ConfigJob } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(ConfigJob.tableName, (table) => {
    table.increments();
    table.string('job_name').index().notNullable();
    table.integer('expected_row').notNullable();
    table.integer('block_range').notNullable();
    table.integer('acceptance_error').notNullable();
    table.integer('block_balance').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {}
