import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feegrant_history', (table) => {
    table.boolean('processed').defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feegrant_history', (table) => {
    table.dropColumn('processed');
  });
}
