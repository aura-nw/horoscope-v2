//FIXME: increase performance for this query.
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createMaterializedView(
    'm_view_count_erc721_txs',
    (view) => {
      view.as(
        knex('erc721_contract')
          .select(
            'erc721_contract.address',
            'erc721_contract.name',
            'erc721_contract.symbol'
          )
          .count('erc721_activity.id AS total_tx')
          .count('transaction.id as transfer_24h')
          .join(
            'erc721_activity',
            'erc721_contract.address',
            'erc721_activity.erc721_contract_address'
          )
          .leftJoin('transaction', function () {
            this.on('erc721_activity.tx_hash', '=', 'transaction.hash').andOn(
              'transaction.timestamp',
              '>',
              knex.raw("now() - '24 hours'::interval")
            );
          })
          .groupBy(
            'erc721_contract.address',
            'erc721_contract.name',
            'erc721_contract.symbol'
          )
      );
    }
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropMaterializedViewIfExists('m_view_count_erc721_txs');
}
