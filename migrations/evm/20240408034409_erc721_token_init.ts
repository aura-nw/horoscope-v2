import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('erc721_token', (table) => {
    table.increments('id').primary();
    table.string('token_id').index();
    table.string('owner');
    table.string('erc721_contract_address').index().notNullable();
    table.integer('last_updated_height').index();
    table.unique(['token_id', 'erc721_contract_id']);
    table
      .foreign('erc721_contract_address')
      .references('erc721_contract.address');
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('erc721_token');
}
