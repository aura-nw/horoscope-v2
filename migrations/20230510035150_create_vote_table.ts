import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vote', (table) => {
    table.increments();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.string('voter').notNullable().index();
    table.integer('tx_id').index();
    table.foreign('tx_id').references('transaction.id');
    table.string('vote_option').notNullable().index();
    table.string('proposal_id').notNullable().index();
    table.string('txhash').notNullable();
    table.integer('height').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('vote');
}
