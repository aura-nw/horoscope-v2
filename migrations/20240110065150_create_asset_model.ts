import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('asset', (table) => {
    table.increments('id').primary();
    table.string('denom').unique().notNullable();
    table.string('decimal').index();
    table.string('name').index();
    table.string('type').index().notNullable();
    table.float('price');
    table.decimal('total_supply', 80, 0);
    table.string('origin_id').index();
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('asset');
}
