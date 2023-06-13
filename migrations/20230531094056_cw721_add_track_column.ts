import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_contract', (table) => {
    table.boolean('track').defaultTo(false);
    table.string('name');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_contract', (table) => {
    table.dropColumn('track');
    table.dropColumn('name');
  });
}
