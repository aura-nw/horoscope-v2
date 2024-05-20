import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('nft_asset', (table) => {
    table.increments('id').primary();
    table.string('address').index().notNullable();
    table.integer('total_activity').index().notNullable();
    table.string('type').index().notNullable();
    table.integer('transfer_24h').index().notNullable();
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.unique('address');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('nft_asset');
}
