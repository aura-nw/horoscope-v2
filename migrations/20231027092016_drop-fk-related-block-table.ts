import { Knex } from 'knex';

// Drop block_height foreign key on transaction table that currently linked to block table
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event', (table) => {
    table.dropForeign('block_height', 'event_block_height_foreign');
  });
  await knex.schema.alterTable('event_attribute', (table) => {
    table.dropForeign(
      'block_height',
      'event_attribute_partition_block_height_foreign'
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event', (table) => {
    table
      .foreign('block_height', 'event_block_height_foreign')
      .references('block.height');
  });
  await knex.schema.alterTable('event_attribute', (table) => {
    table
      .foreign('block_height', 'event_attribute_partition_block_height_foreign')
      .references('block.height');
  });
}
