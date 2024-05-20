import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createView('view_nft_asset', (viewBuilder) => {
    viewBuilder.as(
      knex('erc721_contract')
        .join(
          'erc721_stats',
          'erc721_contract.id',
          'erc721_stats.erc721_contract_id'
        )
        .select(
          'erc721_contract.address',
          'erc721_stats.total_activity',
          'erc721_stats.transfer_24h',
          'erc721_contract.name',
          'erc721_contract.id',
          knex.raw('? as type', ['ERC721'])
        )
        .union([
          knex('cw721_contract')
            .join(
              'cw721_contract_stats',
              'cw721_contract.id',
              'cw721_contract_stats.cw721_contract_id'
            )
            .join(
              'smart_contract',
              'cw721_contract.contract_id',
              'smart_contract.id'
            )
            .select(
              'smart_contract.address',
              'cw721_contract_stats.total_activity',
              'cw721_contract_stats.transfer_24h',
              'cw721_contract.name',
              'cw721_contract.id',
              knex.raw('? as type', ['CW721'])
            ),
        ])
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropViewIfExists('view_nft_asset');
}
