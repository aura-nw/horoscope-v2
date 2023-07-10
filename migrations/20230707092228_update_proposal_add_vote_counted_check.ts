import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('proposal', (table: any) => {
    table.boolean('vote_counted').index().defaultTo(false).notNullable();
    table.float('turnout', 13, 10).nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('proposal', (table: any) => {
    table.float('turnout', 13, 10).notNullable().alter();
    table.dropColumn('vote_counted');
  });
}
