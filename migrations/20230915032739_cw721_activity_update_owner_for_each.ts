import { Knex } from 'knex';
import CW721Activity from '../src/models/cw721_tx';
import _, { Dictionary } from 'lodash';
import { CW721_ACTION } from '../src/services/cw721/cw721.service';

export async function up(knex: Knex): Promise<void> {
  await knex('cw721_activity').update({
    sender: knex.ref('from'),
  });
  await knex.transaction(async (trx) => {
    const activities = await CW721Activity.query()
      .joinRelated('event')
      .orderBy('event.id', 'asc')
      .transacting(trx);
    const latestOwners: Dictionary<string | null> = {};
    activities.forEach((activity) => {
      const latestOwner =
        latestOwners[
          activity.cw721_contract_id + '_' + activity.cw721_token_id
        ];
      if (latestOwner) {
        activity.from = latestOwner;
      } else {
        activity.from = null;
      }
      if (
        activity.action === CW721_ACTION.MINT ||
        activity.action === CW721_ACTION.TRANSFER ||
        activity.action === CW721_ACTION.SEND_NFT
      ) {
        latestOwners[
          activity.cw721_contract_id + '_' + activity.cw721_token_id
        ] = activity.to;
      }
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

export async function down(knex: Knex): Promise<void> {}
