import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_contract', (table) => {
    table.integer('last_updated_height').index();
  });
  await knex.schema.alterTable('cw20_holder', (table) => {
    table.unique(['cw20_contract_id', 'address']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_contract', (table) => {
    table.dropColumn('last_updated_height');
  });
  await knex.schema.alterTable('cw20_holder', (table) => {
    table.dropUnique(['cw20_contract_id', 'address']);
  });
}
