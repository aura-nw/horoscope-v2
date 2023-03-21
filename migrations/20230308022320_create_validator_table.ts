import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('validator', (table: any) => {
    table.increments();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.string('operator_address').unique().notNullable();
    table.string('account_address').unique().notNullable();
    table.string('consensus_address').unique().notNullable();
    table.string('consensus_hex_address').unique().notNullable();
    table.jsonb('consensus_pubkey').notNullable();
    table.boolean('jailed').notNullable();
    table.string('status').notNullable();
    table.decimal('tokens', 30, 0).notNullable();
    table.decimal('delegator_shares', 50, 20).notNullable();
    table.jsonb('description').notNullable();
    table.integer('unbonding_height').notNullable();
    table.timestamp('unbonding_time').notNullable();
    table.jsonb('commission').notNullable();
    table.integer('min_self_delegation').notNullable();
    table.integer('uptime').notNullable();
    table.decimal('self_delegation_balance', 30).notNullable();
    table.float('percent_voting_power', 12, 10).notNullable();
    table.integer('start_height').notNullable();
    table.integer('index_offset').notNullable();
    table.timestamp('jailed_until').notNullable();
    table.boolean('tombstoned').notNullable();
    table.integer('missed_blocks_counter').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('validator');
}
