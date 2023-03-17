import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('account', (table: any) => {
    table.increments();
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
    table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    table.string('address').unique().notNullable();
    table.jsonb('balances');
    table.jsonb('spendable_balances');
    table.string('type');
    table.jsonb('pubkey');
    table.integer('account_number');
    table.integer('sequence');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('account');
}
