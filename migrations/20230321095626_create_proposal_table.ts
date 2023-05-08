import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('proposal', (table: any) => {
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.integer('proposal_id').primary();
    table.integer('proposer_id').index().notNullable();
    table.timestamp('voting_start_time').notNullable();
    table.timestamp('voting_end_time').notNullable();
    table.timestamp('submit_time').notNullable();
    table.timestamp('deposit_end_time').notNullable();
    table.string('type').notNullable();
    table.string('title').notNullable();
    table.text('description').notNullable();
    table.jsonb('content').notNullable();
    table.string('status').notNullable();
    table.jsonb('tally').notNullable();
    table.jsonb('initial_deposit').notNullable();
    table.jsonb('total_deposit').notNullable();
    table.float('turnout', 13, 10).notNullable();
    table.foreign('proposer_id').references('account.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('proposal');
}
