import { Knex } from 'knex';

// Drop block_height foreign key on transaction table that currently linked to block table
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction', (table) => {
    table.dropForeign('height', 'transaction_height_foreign');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transaction', (table) => {
    table
      .foreign('height', 'transaction_height_foreign')
      .references('block.height');
  });
}
