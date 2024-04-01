import { Knex } from 'knex';
import { Cw20Activity } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_activity', (table) => {
    table.integer('tx_id').index();
  });

  let currentId = 0;
  const chunkSizeQuery = 10000;
  let cw20Activities;
  do {
    cw20Activities = await knex.raw(
      `SELECT cw20_activity.id as id, transaction.id as tx_id FROM cw20_activity JOIN transaction on cw20_activity.tx_hash = transaction.hash WHERE cw20_activity.id > ${currentId} ORDER BY id LIMIT ${chunkSizeQuery}`
    );
    if (cw20Activities.rows.length === 0) {
      break;
    }
    const stringListUpdates = cw20Activities.rows
      .map((update: any) => `(${update.id}, ${update.tx_id})`)
      .join(',');
    await knex.raw(
      `UPDATE cw20_activity SET tx_id = temp.tx_id from (VALUES ${stringListUpdates}) as temp(id, tx_id) where temp.id = cw20_activity.id`
    );
    currentId = cw20Activities.rows[cw20Activities.rows.length - 1].id;
  } while (cw20Activities.rows.length > 0);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_activity', (table) => {
    table.dropColumn('tx_id');
  });
}
