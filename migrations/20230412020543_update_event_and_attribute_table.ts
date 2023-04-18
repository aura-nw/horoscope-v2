import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.renameTable(
    'transaction_event_attribute',
    'event_attribute'
  );
  await knex.schema.renameTable('transaction_event', 'event');
  await knex.schema.alterTable('event', (table) => {
    table.integer('block_height').index();
    table.string('source');
    table.setNullable('tx_id');
    table.foreign('block_height').references('block.height');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event', (table) => {
    table.dropColumns('block_height', 'source');
    table.dropNullable('tx_id');
  });

  await knex.schema.renameTable(
    'event_attribute',
    'transaction_event_attribute'
  );
  await knex.schema.renameTable('event', 'transaction_event');
}
