import { Knex } from 'knex';
import { Cw20Event } from '../src/models';
import _ from 'lodash';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_activity', (table) => {
    table.string('tx_hash').defaultTo('');
  });
  await knex.transaction(async (trx) => {
    let currentId = 0;
    while (true) {
      const cw20Activities = await Cw20Event.query()
        .transacting(trx)
        .joinRelated('event.message.transaction')
        .where('event.id', '>', currentId)
        .orderBy('event.id', 'asc')
        .limit(1000)
        .select(
          'cw20_activity.*',
          'event:message:transaction.hash as tx_hash',
          'event.id as event_id'
        );
      if (cw20Activities.length > 0) {
        await Cw20Event.query()
          .insert(
            cw20Activities.map((activity) => _.omit(activity, 'event_id'))
          )
          .onConflict(['id'])
          .merge()
          .transacting(trx);
        currentId = cw20Activities[cw20Activities.length - 1].event_id;
      } else {
        break;
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_activity', (table) => {
    table.dropColumn('tx_hash');
  });
}
