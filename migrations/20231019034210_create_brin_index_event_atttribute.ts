import { Knex } from 'knex';
import { environmentDeploy } from '../src/common';
const envDeploy = process.env.NODE_ENV;

export async function up(knex: Knex): Promise<void> {
  if (envDeploy !== environmentDeploy.development) return;

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS brin_idx_blh_event_attribute
    ON event_attribute USING brin (block_height) WITH (PAGES_PER_RANGE = 10, AUTOSUMMARIZE = true)
  `);
  await knex.schema.alterTable('event_attribute', (table) => {
    // table.index('block_height', `brin_idx_blh_event_attribute`, 'brin');
    table.index('tx_id', `brin_idx_tx_id_event_attribute}`, 'brin');
  });
}
export async function down(knex: Knex): Promise<void> {
  if (envDeploy !== environmentDeploy.development) return;

  await knex.schema.alterTable('event_attribute', (table) => {
    table.dropIndex('block_height', `brin_idx_blh_event_attribute`);
    table.dropIndex('tx_id', `brin_idx_tx_id_event_attribute}`);
  });
}
