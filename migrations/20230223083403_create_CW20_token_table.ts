import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('CW20_Token', (table) => {
    table.string('code_id');
    table.string('asset_info');
    table.string('contract_address');
    table.string('marketing_info');
    table.primary(['contract_address']);
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('deleted_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('CW20_Token');
}
