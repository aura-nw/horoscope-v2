import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('account_vesting', (table: any) => {
    table.increments();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.integer('account_id').unique().notNullable();
    table.jsonb('original_vesting').notNullable();
    table.jsonb('delegated_free').notNullable();
    table.jsonb('delegated_vesting').notNullable();
    table.integer('start_time');
    table.integer('end_time').notNullable();
    table.foreign('account_id').references('account.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('account_vesting');
}
