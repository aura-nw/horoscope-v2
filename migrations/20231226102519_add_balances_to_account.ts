import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTableIfNotExists('account_balance', (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable();
    table.foreign('account_id').references('account.id').onDelete('cascade');
    table.string('denom').notNullable();
    table.decimal('amount', 80, 0);
    table.string('base_denom').nullable();
    table.unique(['account_id', 'denom']);
    table.timestamp('created_at').defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').defaultTo(knex.raw('now()'));

    table.index(['denom']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('account_balance');
}
