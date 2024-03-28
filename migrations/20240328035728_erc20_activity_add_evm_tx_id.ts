import { Knex } from 'knex';
import { Erc20Activity } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc20_activity', (table) => {
    table.integer('evm_transaction_id').index();
    table.foreign('evm_transaction_id').references('evm_transaction.id');
  });
  await knex.transaction(async (trx) => {
    const erc20Activities = await Erc20Activity.query()
      .transacting(trx)
      .join('evm_transaction', 'erc20_activity.tx_hash', 'evm_transaction.hash')
      .select('erc20_activity.*', 'evm_transaction.id as evm_transaction_id');
    if (erc20Activities.length > 0) {
      await Erc20Activity.query()
        .transacting(trx)
        .insert(erc20Activities)
        .onConflict(['id'])
        .merge();
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc20_activity', (table) => {
    table.dropColumn('evm_transaction_id');
  });
}
