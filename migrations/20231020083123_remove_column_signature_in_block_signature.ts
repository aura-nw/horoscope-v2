import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('block_signature', (table) => {
    table.dropColumn('signature');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('block_signature', (table) => {
    table.text('signature');
  });
}
