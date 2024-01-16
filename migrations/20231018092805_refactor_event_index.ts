import { Knex } from 'knex';
import { chainIdConfigOnServer, environmentDeploy } from '../src/common';
import config from '../config.json' assert { type: 'json' };
const envDeploy = process.env.NODE_ENV;

export async function up(knex: Knex): Promise<void> {
  if (
    envDeploy !== environmentDeploy.development ||
    // Sei chain don't need to run this migration
    config.chainId === chainIdConfigOnServer.Pacific1 ||
    config.chainId === chainIdConfigOnServer.Atlantic2
  )
    return;

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS brin_idx_block_height_event
    ON event USING brin (block_height) WITH (PAGES_PER_RANGE = 10, AUTOSUMMARIZE = true)
  `);
  await knex.schema.alterTable('event', (table) => {
    table.index('tx_id', 'brin_idx_tx_id_event', 'brin');
  });
}

export async function down(knex: Knex): Promise<void> {
  if (envDeploy !== environmentDeploy.development) return;

  await knex.schema.alterTable('event', (table) => {
    table.dropIndex('block_height', 'brin_idx_block_height_event');
    table.dropIndex('tx_id', 'brin_idx_tx_id_event');
  });
}
