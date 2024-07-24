import { Knex } from 'knex';
import { DailyStatistics } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(DailyStatistics.tableName, (table) => {
    table.setNullable('unique_addresses');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(DailyStatistics.tableName, (table) => {
    table.dropNullable('unique_addresses');
  });
}
