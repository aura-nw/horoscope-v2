import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('proposal', (table) => {
    table.timestamp('voting_start_time').nullable().alter();
    table.timestamp('voting_end_time').nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('proposal', (table) => {
    table.timestamp('voting_start_time').notNullable().alter();
    table.timestamp('voting_end_time').notNullable().alter();
  });
}
