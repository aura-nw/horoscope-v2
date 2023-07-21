import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ibc_tao_history', (table) => {
    table.increments();
    table.string('type');
    table.integer('ibc_client_id');
    table.integer('event_id').index().notNullable();
    table.foreign('event_id').references('event.id');
    table.foreign('ibc_client_id').references('ibc_client.id');
  });
  await knex.schema.createTable('ibc_client', (table) => {
    table.increments();
    table.string('client_id').notNullable().index();
    table.string('counterparty_chain_id');
    table.jsonb('client_state');
    table.jsonb('consensus_state');
    table.string('client_type');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ibc_client');
  await knex.schema.dropTableIfExists('ibc_tao_history');
}
