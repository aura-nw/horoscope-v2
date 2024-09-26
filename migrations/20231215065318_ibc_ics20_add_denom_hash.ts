import { Knex } from 'knex';
import { IbcIcs20 } from '../src/models';
import { createHash } from 'crypto';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ibc_ics20', (table) => {
    table.string('denom_hash').defaultTo('');
  });
  await knex.transaction(async (trx) => {
    const ibcIcs20s = await IbcIcs20.query().transacting(trx);
    if (ibcIcs20s.length > 0) {
      await IbcIcs20.query()
        .transacting(trx)
        .insert(
          ibcIcs20s.map((ibcIcs20) => {
            ibcIcs20.denom_hash =
              'ibc/' +
              createHash('sha256')
                .update(ibcIcs20.denom)
                .digest('hex')
                .toUpperCase();
            return ibcIcs20;
          })
        )
        .onConflict(['id'])
        .merge();
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ibc_ics20', (table) => {
    table.dropColumn('denom_hash');
  });
}
