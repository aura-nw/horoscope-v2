import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chain_property', (table: any) => {
    table.increments();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.jsonb('community_pool').notNullable();
    table.float('inflation', 6, 20).notNullable();
    table.jsonb('pool').notNullable();
    table.jsonb('supply').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  knex.schema.dropTable('chain_property');
}
