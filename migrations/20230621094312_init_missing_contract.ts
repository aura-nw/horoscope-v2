import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('missing_contract_checkpoint', (table) => {
    table.increments('id').primary();
    table.integer('smart_contract_id').index().notNullable();
    table.integer('checkpoint').index().notNullable();
    table.integer('end_block').index().notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.foreign('smart_contract_id').references('smart_contract.id');
  });
}

export async function down(knex: Knex): Promise<void> {}
