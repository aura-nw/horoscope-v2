import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_activity', (table) => {
    table.string('owner');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_activity', (table) => {
    table.dropColumn('owner');
  });
}
