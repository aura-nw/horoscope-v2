import { Knex } from 'knex';
import { SmartContract } from '../src/models';
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const keepRecords = await SmartContract.query()
      .select('address', 'instantiate_hash', knex.raw('MIN("id") as id'))
      .groupBy(['address', 'instantiate_hash'])
      .havingRaw('count(*) > 1')
      .transacting(trx);
    for (const keepRecord of keepRecords) {
      await SmartContract.query()
        .where('address', keepRecord.address)
        .where('instantiate_hash', keepRecord.instantiate_hash)
        .whereNot('id', keepRecord.id)
        .del()
        .transacting(trx);
    }
  });
}
export async function down(knex: Knex): Promise<void> {}
