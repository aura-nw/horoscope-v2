import { Knex } from 'knex';

/**
 * Generates a materialized view for account balance statistics by aggregating data from multiple tables.
 * Sum available amount and delegated amount.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    CREATE MATERIALIZED VIEW m_view_account_balance_statistic AS
    SELECT account.address,
          account_balance.denom,
          Sum(delegator_sum_amount.amount)
          + Sum(account_balance.amount) AS amount
    FROM   account_balance
          INNER JOIN account
                  ON account.id = account_balance.account_id
          INNER JOIN (SELECT delegator_address AS address,
                              Sum(amount)       AS amount
                      FROM   delegator
                      GROUP  BY address) AS delegator_sum_amount
                  ON delegator_sum_amount.address = account.address
    WHERE  denom NOT LIKE 'ibc/%'
          AND denom NOT LIKE '0x%'
    GROUP  BY account.address,
              account_balance.denom;

    CREATE INDEX idx_materialized_view_name_address ON m_view_account_balance_statistic(address);
    CREATE INDEX idx_materialized_view_name_denom ON m_view_account_balance_statistic(denom);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropMaterializedViewIfExists(
    'm_view_account_balance_statistic'
  );
}
