import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event_attribute', (table) => {
    table.index('block_height', `brin_idx_blh_event_attribute`, 'brin');
    table.index('tx_id', `brin_idx_tx_id_event_attribute}`, 'brin');
  });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event_attribute', (table) => {
    table.dropIndex('block_height', `brin_idx_blh_event_attribute`);
    table.dropIndex('tx_id', `brin_idx_tx_id_event_attribute}`);
  });
}
