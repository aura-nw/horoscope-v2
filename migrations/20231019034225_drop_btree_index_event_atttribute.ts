import { Knex } from 'knex';
import { environmentDeploy } from '../src/common';
const envDeploy = process.env.NODE_ENV;

export async function up(knex: Knex): Promise<void> {
  if (envDeploy !== environmentDeploy.development) return;

  await knex.schema.alterTable('event_attribute', (table) => {
    table.dropIndex(
      'block_height',
      'event_attribute_partition_block_height_index'
    );
    table.dropIndex('tx_id', 'event_attribute_partition_tx_id_index');
  });
}
export async function down(knex: Knex): Promise<void> {
  if (envDeploy !== environmentDeploy.development) return;

  await knex.schema.alterTable('event_attribute', (table) => {
    table.index(
      'block_height',
      'event_attribute_partition_block_height_index',
      'btree'
    );
    table.index('tx_id', 'event_attribute_partition_tx_id_index', 'btree');
  });
}
