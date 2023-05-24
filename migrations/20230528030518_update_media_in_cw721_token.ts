import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_token', (table) => {
    table.jsonb('media_info');
    table.dropColumn('token_uri');
    table.dropColumn('extension');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_token', (table) => {
    table.dropColumn('media_info');
    table.string('token_uri');
    table.jsonb('extension');
  });
}
