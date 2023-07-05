import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_activity', (table) => {
    table.integer('smart_contract_event_id').index();
    table
      .foreign('smart_contract_event_id')
      .references('smart_contract_event.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_activity', (table) => {
    table.dropForeign('smart_contract_event_id');
    table.dropColumn('smart_contract_event_id');
  });
}
