import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('smart_contract_event_attribute', (table) => {
    table.text('value').alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('smart_contract_event_attribute', (table) => {
    table.string('value').alter();
  });
}
