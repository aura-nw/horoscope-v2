import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('CW20_Holder', (table) => {
    table.string('address');
    table.string('balance');
    table.string('cw20_token');
    table.foreign('cw20_token').references('CW20_Token.contract_address');
    table.primary(['address', 'cw20_token']);
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('deleted_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('CW20_Holder');
}
