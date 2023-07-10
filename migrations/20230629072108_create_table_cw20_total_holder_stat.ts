import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cw20_total_holder_stats', (table) => {
    table.increments();
    table.integer('cw20_contract_id').notNullable();
    table.foreign('cw20_contract_id').references('cw20_contract.id');
    table.integer('total_holder');
    table.date('date').index().notNullable();
    table.unique(['cw20_contract_id', 'date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cw20_total_holder_stats');
}
