import { Knex } from 'knex';
import config from '../config.json' assert { type: 'json' };
import CW721Token from '../src/models/cw721_token';
import CW721Activity from '../src/models/cw721_tx';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_contract', (table) => {
    table.integer('total_suply').defaultTo(0);
    table.integer('no_holders').defaultTo(0);
    table.jsonb('no_activities').defaultTo('{}');
  });
  await knex.transaction(async (trx) => {
    await knex
      .raw(
        `set statement_timeout to ${config.cw721.jobCw721Update.statementTimeout}`
      )
      .transacting(trx);
    const totalSupplies = await CW721Token.query()
      .transacting(trx)
      .select('cw721_contract_id')
      .where('burned', false)
      .groupBy('cw721_contract_id')
      .count();
    if (totalSupplies.length > 0) {
      const stringListUpdates = totalSupplies
        .map(
          (totalSuply) =>
            `(${totalSuply.cw721_contract_id}, ${totalSuply.count})`
        )
        .join(',');
      await knex
        .raw(
          `UPDATE cw721_contract SET total_suply = temp.total_suply from (VALUES ${stringListUpdates}) as temp(id, total_suply) where temp.id = cw721_contract.id`
        )
        .transacting(trx);
    }
    const noActivities = await CW721Activity.query()
      .transacting(trx)
      .select('cw721_contract_id', 'action')
      .groupBy('cw721_contract_id', 'action')
      .count();
    const results = noActivities.reduce((acc, curr) => {
      if (!acc[curr.cw721_contract_id]) {
        acc[curr.cw721_contract_id] = {};
      }
      acc[curr.cw721_contract_id][curr.action] = curr.count;
      return acc;
    }, {});
    if (Object.values(results).length > 0) {
      const stringListUpdates = Object.keys(results)
        .map((key) => `(${key}, '${JSON.stringify(results[key])}'::jsonb)`)
        .join(',');
      await knex
        .raw(
          `UPDATE cw721_contract SET no_activities = temp.no_activities from (VALUES ${stringListUpdates}) as temp(id, no_activities) where temp.id = cw721_contract.id`
        )
        .transacting(trx);
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_contract', (table) => {
    table.dropColumns('total_suply', 'no_holders', 'no_activities');
  });
}
