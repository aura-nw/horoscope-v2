import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cw20_total_holder_stats', (table) => {
    table.increments();
    table.integer('cw20_contract_id').notNullable().index();
    table.foreign('cw20_contract_id').references('cw20_contract.id');
    table.integer('total_holder');
    table.date('created_at').index().notNullable().defaultTo(knex.raw('now()'));
    table.unique(['cw20_contract_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cw20_total_holder_stats');
}
