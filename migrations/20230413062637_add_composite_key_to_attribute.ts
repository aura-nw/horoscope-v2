import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event_attribute', (table) => {
    table.integer('tx_id').index();
    table.integer('block_height').index();
    table.string('composite_key').index();
    table.foreign('tx_id').references('transaction.id');
    table.foreign('block_height').references('block.height');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event_attribute', (table) => {
    table.dropColumns('block_height', 'tx_id', 'composite_key');
  });
}
