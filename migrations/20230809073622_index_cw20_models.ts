import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_activity', (table) => {
    table.index('from');
    table.index('to');
    table.index('action');
  });
  await knex.schema.alterTable('cw721_activity', (table) => {
    table.index('from');
    table.index('to');
    table.index('action');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_activity', (table) => {
    table.dropIndex('from');
    table.dropIndex('to');
    table.dropIndex('action');
  });
  await knex.schema.alterTable('cw721_activity', (table) => {
    table.dropIndex('from');
    table.dropIndex('to');
    table.dropIndex('action');
  });
}
