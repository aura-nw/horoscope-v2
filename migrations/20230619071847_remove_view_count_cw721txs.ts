import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropMaterializedViewIfExists('m_view_count_cw721_txs');
}

export async function down(knex: Knex): Promise<void> {}
