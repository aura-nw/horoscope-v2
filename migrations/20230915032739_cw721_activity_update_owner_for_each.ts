import { Knex } from 'knex';
import CW721Activity from '../src/models/cw721_tx';
import _, { Dictionary } from 'lodash';
import { CW721_ACTION } from '../src/services/cw721/cw721_handler';

export async function up(knex: Knex): Promise<void> {
  await knex('cw721_activity').update({
    sender: knex.ref('from'),
  });
  await knex.transaction(async (trx) => {
    let currentId = 0;
    const latestOwners: Dictionary<string | null> = {};
    while (true) {
      const activities = await CW721Activity.query()
        .transacting(trx)
        .joinRelated('event')
        .where('event.id', '>', currentId)
        .orderBy('event.id', 'asc')
        .limit(1000)
        .select('cw721_activity.*', 'event.id as event_id');
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
          .insert(_.omit(activities, 'event_id'))
          .onConflict(['id'])
          .merge()
          .transacting(trx);
        currentId = activities[activities.length - 1].event_id;
      } else {
        break;
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {}
