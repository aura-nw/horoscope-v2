import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('cw20_tokens', (table) => {
    table.increments();
    table.string('code_id').notNullable().index();
    table.string('asset_info');
    table.string('contract_address').notNullable().unique().index();
    table.string('marketing_info');
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('cw20_tokens');
}
