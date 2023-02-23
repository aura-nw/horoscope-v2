import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('CW20_Holder', (table) => {
    table.increments('holder_id');
    table.string('address');
    table.string('balance');
    table.integer('token_id');
    table.foreign('token_id').references('CW20_Token.id');

    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('deleted_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('CW20_Holder');
}
