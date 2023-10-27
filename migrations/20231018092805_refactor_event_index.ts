import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('set statement_timeout to 600000');
  await knex.schema.alterTable('event', (table) => {
    table.index('block_height', 'brin_idx_block_height_event', 'brin');
    table.index('tx_id', 'brin_idx_tx_id_event', 'brin');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event', (table) => {
    table.dropIndex('block_height', 'brin_idx_block_height_event');
    table.dropIndex('tx_id', 'brin_idx_tx_id_event');
  });
}
