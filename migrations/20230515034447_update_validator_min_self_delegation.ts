import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('validator', (table) => {
    table.decimal('min_self_delegation', 30, 0).notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('validator', (table) => {
    table.integer('min_self_delegation').notNullable().alter();
  });
}
