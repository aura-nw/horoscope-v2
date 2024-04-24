import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('evm_proxy_history', (table) => {
    table.increments();
    table.string('proxy_contract').index().notNullable();
    table.string('implementation_contract').index();
    table.string('admin');
    table.string('tx_hash').index().notNullable();
    table.integer('block_height');
    table.integer('last_updated_height');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('evm_proxy_history');
}
