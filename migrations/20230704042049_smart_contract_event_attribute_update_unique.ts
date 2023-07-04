import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('smart_contract_event_attribute', (table) => {
    table.dropUnique(['smart_contract_event_id', 'key', 'value']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('smart_contract_event_attribute', (table) => {
    table.unique(['smart_contract_event_id', 'key', 'value']);
  });
}
