import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('proposal', (table) => {
    table.jsonb('count_vote');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('proposal', (table) => {
    table.dropColumn('count_vote');
  });
}
