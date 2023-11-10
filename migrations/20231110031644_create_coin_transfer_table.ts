import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTableIfNotExists('coin_transfer', (table) => {
    table.increments('id').primary();
    table.integer('block_height').notNullable().index();
    table.integer('tx_id').notNullable().index();
    table.integer('tx_msg_id').notNullable().index();
    table.string('from').index();
    table.string('to').index();
    table.bigint('amount');
    table.string('denom');
    table.timestamp('timestamp').index();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['denom', 'amount']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('coin_transfer');
}
