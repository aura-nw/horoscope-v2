import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('validator', (table: any) => {
    table.string('image_url').default('validator-default.svg');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('validator', (table: any) => {
    table.dropColumn('image_url');
  });
}
