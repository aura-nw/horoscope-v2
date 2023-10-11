import { Knex } from 'knex';
import { Cw20Activity } from '../src/models';
import _ from 'lodash';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw20_activity', (table) => {
    table.string('tx_hash').defaultTo('');
  });
  await knex.transaction(async (trx) => {
    let currentId = 0;
    while (true) {
      const cw20Activities = await Cw20Activity.query()
        .transacting(trx)
        .joinRelated('event.message.transaction')
        .where('cw20_activity.id', '>', currentId)
        .orderBy('cw20_activity.id', 'asc')
        .limit(1000)
        .select('cw20_activity.*', 'event:message:transaction.hash as tx_hash');
      if (cw20Activities.length > 0) {
        await Cw20Activity.query()
          .insert(cw20Activities)
          .onConflict(['id'])
          .merge()
          .transacting(trx);
        currentId = cw20Activities[cw20Activities.length - 1].id;
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
