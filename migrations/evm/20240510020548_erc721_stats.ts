import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('erc721_stats', (table) => {
    table.increments();
    table.integer('erc721_contract_id').unique().notNullable();
    table.foreign('erc721_contract_id').references('erc721_contract.id');
    table.integer('total_activity').defaultTo(0);
    table.integer('transfer_24h').defaultTo(0);
    table.dateTime('updated_at').defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('erc721_stats');
}
