import { Knex } from 'knex';
import { Feegrant, TransactionMessage } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feegrant', (table) => {
    table.integer('init_msg_id').index().unique();
  });
  let currentId = 0;
  while (true) {
    const feegrants = await Feegrant.query(knex)
      .withGraphFetched('init_transaction.messages')
      .where('feegrant.id', '>', currentId)
      .orderBy('feegrant.id', 'asc')
      .limit(100);
    if (feegrants.length > 0) {
      feegrants.forEach((feegrant) => {
        const initMsg = feegrant.init_transaction?.messages.find(
          (msg: TransactionMessage) =>
            msg.type === '/cosmos.feegrant.v1beta1.MsgGrantAllowance'
        );
        feegrant.init_msg_id = initMsg?.id;
      });
      await Feegrant.query(knex).insert(feegrants).onConflict(['id']).merge();
      currentId = feegrants[feegrants.length - 1].id;
    } else {
      break;
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feegrant', (table) => {
    table.dropColumn('init_msg_id');
  });
}
