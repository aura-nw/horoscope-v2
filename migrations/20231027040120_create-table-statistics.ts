import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('statistics', (table: any) => {
    // Name for statistic such as total_transaction, total_account, and so on
    table.string('key').primary();
    // Value of key name above
    table.bigint('value').notNullable().defaultTo(0);
    // Determine statistic has been counted since something (block, timestamp, date, and so on)
    table.string('statistic_since').nullable();
    table.dateTime('updated_at').defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('statistics');
}
