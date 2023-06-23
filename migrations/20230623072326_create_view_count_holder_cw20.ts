import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropViewIfExists('view_count_holder_cw20');
  await knex.schema.createView('view_count_holder_cw20', (viewBuilder) => {
    viewBuilder.as(
      knex('cw20_contract')
        .leftJoin(
          'cw20_holder',
          'cw20_holder.cw20_contract_id',
          'cw20_contract.id'
        )
        .innerJoin(
          'smart_contract',
          'cw20_contract.smart_contract_id',
          'smart_contract.id'
        )
        .select(['smart_contract.address as contract_address'])
        .count()
        .groupBy(['smart_contract.address'])
        .where('cw20_holder.amount', '>', 0)
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropViewIfExists('view_count_holder_cw20');
}
