import { Knex } from 'knex';
import { Erc20Activity } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc20_activity', (table) => {
    table.integer('evm_tx_id').index();
    table.foreign('evm_tx_id').references('evm_transaction.id');
  });
  const erc20Activities = await Erc20Activity.query(knex)
    .join('evm_transaction', 'erc20_activity.tx_hash', 'evm_transaction.hash')
    .select('erc20_activity.*', 'evm_transaction.id as evm_tx_id');
  if (erc20Activities.length > 0) {
    const stringListUpdates = erc20Activities.map(
      (erc20Activity) => `(${erc20Activity.id}, ${erc20Activity.evm_tx_id})`
    );
    await knex.raw(
      `UPDATE erc20_activity SET evm_tx_id = temp.evm_tx_id from (VALUES ${stringListUpdates}) as temp(id, evm_tx_id) where temp.id = erc20_activity.id`
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc20_activity', (table) => {
    table.dropColumn('evm_tx_id');
  });
}
