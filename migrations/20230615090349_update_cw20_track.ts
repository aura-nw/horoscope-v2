import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_contract', (table) => {
    table.boolean('track').defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_contract', (table) => {
    table.dropColumn('track');
  });
}
