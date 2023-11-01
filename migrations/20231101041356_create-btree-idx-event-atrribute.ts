import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw('set statement_timeout to 60000000');
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS btree_idx_tx_id
    ON event_attribute USING btree (tx_id)
    WHERE tx_id IS NOT NULL
  `);
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('event_attribute', (table) => {
    table.dropIndex('tx_id', `btree_idx_tx_id`);
  });
}
