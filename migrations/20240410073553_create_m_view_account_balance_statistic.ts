import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    CREATE MATERIALIZED VIEW m_view_account_balance_statistic AS
    SELECT
        account.address,
        denom,
        SUM(delegator.amount) + SUM(account_balance.amount) AS total,
        NOW() AS updated_at
    FROM
        account_balance
    INNER JOIN
        account ON account.id = account_balance.account_id
    INNER JOIN
        delegator ON delegator.delegator_address = account.address
    GROUP BY
        account.address, denom;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropMaterializedViewIfExists(
    'm_view_account_balance_statistic'
  );
}
