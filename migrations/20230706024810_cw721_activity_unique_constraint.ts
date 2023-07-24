import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_activity', (table) => {
    table.unique(['smart_contract_event_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_activity', (table) => {
    table.dropUnique(['smart_contract_event_id']);
  });
}
