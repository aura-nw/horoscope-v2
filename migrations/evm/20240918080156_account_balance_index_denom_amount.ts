import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`set statement_timeout to 0`);
  await knex.raw(
    'CREATE INDEX account_balance_denom_amount_index ON account_balance(denom, amount);'
  );
}

export async function down(knex: Knex): Promise<void> {}
