import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('block', (table: any) => {
    table.increments('id').primary();
    table.timestamp('created_at').defaultTo(knex.raw('now()')).notNullable();
    table.timestamp('updated_at').defaultTo(knex.raw('now()')).notNullable();
    table.decimal('height', null).unique().notNullable();
    table.string('hash').unique().notNullable();
    table.integer('version').notNullable();
    table.jsonb('last_block_id').notNullable();
    table.timestamp('time').notNullable();
    table.string('proposer_address').index().notNullable();
    table.jsonb('data').notNullable();
  });

  await knex.schema.createTable('block_signature', (table: any) => {
    table.increments('id').primary();
    table.timestamp('created_at').defaultTo(knex.raw('now()')).notNullable();
    table.timestamp('updated_at').defaultTo(knex.raw('now()')).notNullable();
    table.integer('block_id').index().notNullable();
    table.integer('block_id_flag').index().notNullable();
    table.string('validator_address').index().notNullable();
    table.timestamp('timestamp').notNullable();
    table.text('signature').notNullable();
    table.foreign('block_id').references('block.id');
  });

  await knex.schema.createTable('transaction', (table: any) => {
    table.increments('id').primary();
    table.timestamp('created_at').defaultTo(knex.raw('now()')).notNullable();
    table.timestamp('updated_at').defaultTo(knex.raw('now()')).notNullable();
    table.decimal('height', null).index().notNullable();
    table.string('hash').unique().notNullable();
    table.string('codespace').notNullable();
    table.integer('code').notNullable();
    table.decimal('gas_used', null).notNullable();
    table.decimal('gas_wanted', null).notNullable();
    table.decimal('gas_limit', null).notNullable();
    table.string('fee').notNullable();
    table.timestamp('timestamp').notNullable();
    table.string('memo').notNullable();
    table.text('signature').notNullable();
    table.jsonb('data').notNullable();
    table.foreign('height').references('block.height');
  });

  await knex.schema.createTable('transaction_message', (table: any) => {
    table.increments('id').primary();
    table.timestamp('created_at').defaultTo(knex.raw('now()')).notNullable();
    table.timestamp('updated_at').defaultTo(knex.raw('now()')).notNullable();
    table.string('tx_hash').index().notNullable();
    table.integer('msg_index').notNullable();
    table.string('type').notNullable();
    table.string('sender').index().notNullable();
    table.specificType('receiver', 'text[]').index().notNullable();
    table.jsonb('content').notNullable();
    table.foreign('tx_hash').references('transaction.hash');
  });

  await knex.schema.createTable('transaction_event', (table: any) => {
    table.increments('id').primary();
    table.timestamp('created_at').defaultTo(knex.raw('now()')).notNullable();
    table.timestamp('updated_at').defaultTo(knex.raw('now()')).notNullable();
    table.string('tx_hash').index().notNullable();
    table.integer('msg_index').notNullable();
    table.string('type').index().notNullable();
    table.foreign('tx_hash').references('transaction.hash');
  });

  await knex.schema.createTable('transaction_event_attribute', (table: any) => {
    table.increments('id').primary();
    table.timestamp('created_at').defaultTo(knex.raw('now()')).notNullable();
    table.timestamp('updated_at').defaultTo(knex.raw('now()')).notNullable();
    table.integer('event_id').index().notNullable();
    table.string('key').index().notNullable();
    table.string('value').notNullable();
    table.foreign('event_id').references('transaction_event.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  knex.schema.dropTable('block');
  knex.schema.dropTable('block_signature');
  knex.schema.dropTable('transaction');
  knex.schema.dropTable('transaction_message');
  knex.schema.dropTable('transaction_event');
  knex.schema.dropTable('transaction_event_attribute');
}
