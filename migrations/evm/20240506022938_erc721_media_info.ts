import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc721_token', (table) => {
    table.jsonb('media_info');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc721_token', (table) => {
    table.dropColumn('media_info');
  });
}
