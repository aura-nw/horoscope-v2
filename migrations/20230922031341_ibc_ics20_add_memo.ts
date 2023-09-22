import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ibc_ics20', (table) => {
    table.string('memo').defaultTo('');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ibc_ics20', (table) => {
    table.dropColumn('memo');
  });
}
