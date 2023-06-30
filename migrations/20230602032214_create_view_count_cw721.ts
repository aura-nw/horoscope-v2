import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createView('view_count_holder_cw721', (viewBuilder) => {
    viewBuilder.as(
      knex('cw721_token')
        .innerJoin(
          'cw721_contract',
          'cw721_token.cw721_contract_id',
          'cw721_contract.id'
        )
        .innerJoin(
          'smart_contract',
          'cw721_contract.contract_id',
          'smart_contract.id'
        )
        .select([
          'cw721_token.owner',
          'smart_contract.address as contract_address',
        ])
        .count()
        .groupBy(['cw721_token.owner', 'smart_contract.address'])
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropViewIfExists('view_count_holder_cw721');
}
