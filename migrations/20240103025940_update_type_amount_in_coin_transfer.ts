import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('coin_transfer', (table) => {
    table.decimal('amount', 80, 0).alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('coin_transfer', (table) => {
    table.bigint('amount').alter();
  });
}
