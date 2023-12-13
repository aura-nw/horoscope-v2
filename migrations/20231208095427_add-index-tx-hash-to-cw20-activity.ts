import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(
    'CREATE INDEX cw20_activity_tx_hash_index ON "cw20_activity" USING hash ("tx_hash")'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_activity', (table) => {
    table.dropIndex(['tx_hash']);
  });
}
