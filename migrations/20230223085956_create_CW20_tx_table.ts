import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('CW20_Tx', (table) => {
    table.increments('id');
    table.string('tx_hash');
    table.integer('cw20_id');
    table.foreign('cw20_id').references('CW20_Token.id');

    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('deleted_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('CW20_Tx');
}
