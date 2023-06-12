//FIXME: increase performance for this query.
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createMaterializedView('m_view_count_cw721_txs', (view) => {
    view.as(
      knex('cw721_contract')
        .select(
          'smart_contract.address AS contract_address',
          'cw721_contract.name',
          'cw721_contract.symbol'
        )
        .count('cw721_activity.id AS total_tx')
        .count('transaction.id as transfer_24h')
        .join(
          'cw721_activity',
          'cw721_contract.id',
          'cw721_activity.cw721_contract_id'
        )
        .join(
          'smart_contract',
          'cw721_contract.contract_id',
          'smart_contract.id'
        )
        .leftJoin('transaction', function () {
          this.on('cw721_activity.tx_hash', '=', 'transaction.hash').andOn(
            'transaction.timestamp',
            '>',
            knex.raw("now() - '24 hours'::interval")
          );
        })
        .groupBy(
          'smart_contract.address',
          'cw721_contract.name',
          'cw721_contract.symbol'
        )
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropMaterializedView('m_view_count_cw721_txs');
}
