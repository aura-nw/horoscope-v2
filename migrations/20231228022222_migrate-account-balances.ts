import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const BATCH_SIZE = 3000;
  const accountIdsWithBalances = await knex('account')
    .select('account.id', 'balances')
    .leftJoin('account_balance', 'account.id', 'account_balance.account_id')
    .whereNull('account_balance.account_id');

  // Create account balance.
  const listAccountBalance = [];
  for (const account of accountIdsWithBalances) {
    const account_id = account.id;

    if (Array.isArray(account.balances))
      for (const balance of account.balances) {
        listAccountBalance.push({
          account_id,
          denom: balance.denom,
          amount: balance.amount,
          base_denom: balance.base_denom,
        });
      }
  }

  if (listAccountBalance.length > 0)
    await knex.batchInsert('account_balance', listAccountBalance, BATCH_SIZE);
}

export async function down(knex: Knex): Promise<void> {}
