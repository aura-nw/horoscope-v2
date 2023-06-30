import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction', (table) => {
    table.dropUnique(['hash']);
    table.index(['hash']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction', (table) => {
    table.dropIndex(['hash']);
    table.unique(['hash']);
  });
}
