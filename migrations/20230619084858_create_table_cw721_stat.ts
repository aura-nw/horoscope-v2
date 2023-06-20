import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cw721_contract_stat', (table) => {
    table.increments();
    table.integer('cw721_contract_id').unique().notNullable();
    table.foreign('cw721_contract_id').references('cw721_contract.id');
    table.integer('total_activity').defaultTo(0);
    table.integer('transfer_24h').defaultTo(0);
    table.dateTime('updated_at').defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cw721_contract_stat');
}
