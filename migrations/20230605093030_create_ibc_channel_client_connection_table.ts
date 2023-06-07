import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ibc_client', (table) => {
    table.increments();
    table.string('client_id').notNullable().unique().index();
    table.string('counterparty_chain_id').notNullable();
    table.jsonb('client_state').notNullable();
    table.string('status').notNullable();
  });
  await knex.schema.createTable('ibc_connection', (table) => {
    table.increments();
    table.string('connection_id').unique().index();
    table.string('client_id').index();
    table.jsonb('version');
    table.string('state');
    table.jsonb('counterparty');
    table.string('delay_period');
    table.jsonb('height');
    table.foreign('client_id').references('ibc_client.client_id');
  });
  await knex.schema.createTable('ibc_channel', (table) => {
    table.increments();
    table.string('state');
    table.string('ordering');
    table.jsonb('counterparty');
    table.jsonb('connection_hops');
    table.string('version');
    table.string('port_id');
    table.string('channel_id').unique().index();
    table.jsonb('height');
    table.string('connection_id').index();
    table.foreign('connection_id').references('ibc_connection.connection_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('ibc_channel');
  await knex.schema.dropTable('ibc_connection');
  await knex.schema.dropTable('ibc_client');
}
