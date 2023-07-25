import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ibc_client', (table) => {
    table.increments();
    table.string('client_id').notNullable().unique();
    table.string('counterparty_chain_id').notNullable();
    table.jsonb('client_state').notNullable();
    table.jsonb('consensus_state').notNullable();
    table.string('client_type').notNullable();
  });
  await knex.schema.createTable('ibc_connection', (table) => {
    table.increments();
    table.integer('ibc_client_id');
    table.string('connection_id').notNullable().unique();
    table.string('counterparty_client_id').notNullable();
    table.string('counterparty_connection_id').notNullable();
    table.foreign('ibc_client_id').references('ibc_client.id');
  });
  await knex.schema.createTable('ibc_channel', (table) => {
    table.increments();
    table.integer('ibc_connection_id');
    table.string('channel_id').notNullable().unique();
    table.string('port_id').notNullable();
    table.string('counterparty_port_id').notNullable();
    table.string('counterparty_channel_id').notNullable();
    table.boolean('state').notNullable();
    table.foreign('ibc_connection_id').references('ibc_connection.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ibc_client');
  await knex.schema.dropTableIfExists('ibc_connection');
  await knex.schema.dropTableIfExists('ibc_channel');
}
