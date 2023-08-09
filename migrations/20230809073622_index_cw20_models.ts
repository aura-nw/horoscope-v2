import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_activity', (table) => {
    table.index('from');
    table.index('to');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('proposal', (table) => {
    table.dropIndex('from');
    table.dropIndex('to');
  });
}
