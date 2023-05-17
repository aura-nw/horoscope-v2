import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('validator', (table) => {
    table.jsonb('last_updated_height').alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('validator', (table) => {
    table.integer('last_updated_height').index().alter();
  });
}
