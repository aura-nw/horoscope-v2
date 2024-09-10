import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('validator', (table) => {
    table.index('tokens');
    table.index('status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('validator', (table) => {
    table.dropIndex('tokens');
    table.dropIndex('status');
  });
}
