import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ibc_ics20', (table) => {
    table.timestamp('start_time');
    table.timestamp('finish_time');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ibc_ics20', (table) => {
    table.dropColumns('start_time', 'finish_time');
  });
}
