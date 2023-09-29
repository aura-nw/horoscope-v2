import { Knex } from 'knex';
import { IbcIcs20, IbcMessage } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ibc_ics20', (table) => {
    table.timestamp('start_time');
    table.timestamp('finish_time');
  });
  await knex.transaction(async (trx) => {
    const ibcIcs20s = await IbcIcs20.query().transacting(trx);
    const ibcMsgs = await IbcMessage.query()
      .transacting(trx)
      .joinRelated('message.transaction')
      .whereIn(
        'sequence_key',
        ibcIcs20s.map((ibcIcs20) => ibcIcs20.sequence_key)
      )
      .select(
        'message:transaction.timestamp',
        'ibc_message.sequence_key',
        'ibc_message.type'
      );
    if (ibcIcs20s.length > 0) {
      ibcIcs20s.forEach((ibcIcs20) => {
        ibcIcs20.start_time =
          ibcIcs20.type === IbcMessage.EVENT_TYPE.SEND_PACKET
            ? ibcMsgs.find(
                (e) =>
                  e.sequence_key === ibcIcs20.sequence_key &&
                  e.type === IbcMessage.EVENT_TYPE.SEND_PACKET
              )?.timestamp
            : null;
        ibcIcs20.finish_time = ibcMsgs.find(
          (e) =>
            e.sequence_key === ibcIcs20.sequence_key &&
            (ibcIcs20.type === IbcMessage.EVENT_TYPE.SEND_PACKET
              ? [
                  IbcMessage.EVENT_TYPE.TIMEOUT_PACKET,
                  IbcMessage.EVENT_TYPE.ACKNOWLEDGE_PACKET,
                ].includes(e.type)
              : [IbcMessage.EVENT_TYPE.RECV_PACKET].includes(e.type))
        )?.timestamp;
      });
      await IbcIcs20.query()
        .transacting(trx)
        .insert(ibcIcs20s)
        .onConflict('id')
        .merge();
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ibc_ics20', (table) => {
    table.dropColumns('start_time', 'finish_time');
  });
}
