import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('evm_event', (table) => {
    table.increments('id').primary();
    table.integer('tx_id').notNullable();
    table.integer('evm_tx_id').notNullable();
    table.string('address').index();
    table.json('topics');
    table.integer('block_height');
    table.string('tx_hash');
    table.integer('tx_index');
    table.string('block_hash');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE evm_event`);
}
