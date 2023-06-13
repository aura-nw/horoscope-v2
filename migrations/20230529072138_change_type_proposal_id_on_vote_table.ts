import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('vote', (table) => {
    table.integer('proposal_id').alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('vote', (table) => {
    table.string('proposal_id').alter();
  });
}
