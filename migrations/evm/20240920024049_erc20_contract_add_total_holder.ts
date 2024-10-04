import { Knex } from 'knex';
import { AccountBalance } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc20_contract', (table) => {
    table.integer('total_holder').defaultTo(0).index();
  });
  await knex.raw(`set statement_timeout to 0`);
  const totalHolders = await AccountBalance.query(knex)
    .select('account_balance.denom')
    .where('account_balance.type', AccountBalance.TYPE.ERC20_TOKEN)
    .andWhere('account_balance.amount', '>', 0)
    .count()
    .groupBy('account_balance.denom');
  if (totalHolders.length > 0) {
    const stringListUpdates = totalHolders
      .map((totalHolder) => `('${totalHolder.denom}', ${totalHolder.count})`)
      .join(',');
    await knex.raw(
      `UPDATE erc20_contract SET total_holder = temp.total_holder from (VALUES ${stringListUpdates}) as temp(address, total_holder) where temp.address = erc20_contract.address`
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc20_contract', (table) => {
    table.dropColumn('total_holder');
  });
}
