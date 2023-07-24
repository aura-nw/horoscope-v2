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
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ibc_client');
}
