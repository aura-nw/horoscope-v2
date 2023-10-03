import { Knex } from 'knex';
import { IbcMessage } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ibc_message', (table) => {
    table.string('tx_hash').defaultTo('');
  });
  await knex.transaction(async (trx) => {
    const ibcMsgs = await IbcMessage.query()
      .transacting(trx)
      .joinRelated('message.transaction')
      .select('ibc_message.*', 'message:transaction.hash as tx_hash');
    if (ibcMsgs.length > 0) {
      await IbcMessage.query()
        .transacting(trx)
        .insert(ibcMsgs)
        .onConflict(['id'])
        .merge();
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ibc_message', (table) => {
    table.dropColumn('tx_hash');
  });
}
