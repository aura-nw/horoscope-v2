import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('erc20_statistic', (table) => {
    table.increments();
    table.integer('erc20_contract_id').notNullable();
    table.foreign('erc20_contract_id').references('erc20_contract.id');
    table.integer('total_holder');
    table.date('date').index().notNullable();
    table.unique(['erc20_contract_id', 'date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('erc20_statistic');
}
