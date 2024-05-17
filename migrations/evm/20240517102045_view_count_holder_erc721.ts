import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createView('view_count_holder_erc721', (viewBuilder) => {
    viewBuilder.as(
      knex('erc721_token')
        .select(['erc721_token.owner', 'erc721_token.erc721_contract_address'])
        .count()
        .groupBy(['erc721_token.owner', 'erc721_token.erc721_contract_address'])
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropViewIfExists('view_count_holder_erc721');
}
