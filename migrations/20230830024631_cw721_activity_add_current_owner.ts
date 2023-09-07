import { Knex } from 'knex';
import CW721Activity from '../src/models/cw721_tx';
import _ from 'lodash';
import { CW721_ACTION } from '../src/services/cw721/cw721.service';
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_activity', (table) => {
    table.string('owner');
  });
  await knex.transaction(async (trx) => {
    const activities = await CW721Activity.query()
      .joinRelated('event')
      .orderBy('event.block_height', 'asc')
      .transacting(trx);
    const done: CW721Activity[] = [];
    activities.forEach((activity) => {
      const latestActivity = _.findLast(done, function (e) {
        return (
          [
            CW721_ACTION.MINT,
            CW721_ACTION.TRANSFER,
            CW721_ACTION.SEND_NFT,
          ].includes(e.action) &&
          e.cw721_contract_id === activity.cw721_contract_id &&
          e.cw721_token_id === activity.cw721_token_id
        );
      });
      if (latestActivity) {
        activity.owner = latestActivity.to;
      } else {
        activity.owner = activity.to;
      }
      done.push(activity);
    });
    if (activities.length > 0) {
      await CW721Activity.query()
        .insert(activities)
        .onConflict(['id'])
        .merge()
        .transacting(trx);
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_activity', (table) => {
    table.dropColumn('owner');
  });
}
