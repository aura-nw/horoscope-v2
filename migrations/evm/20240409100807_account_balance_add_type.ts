import { Knex } from 'knex';
import { AccountBalance } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account_balance', (table) => {
    table.string('type').defaultTo(AccountBalance.TYPE.NATIVE);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account_balance', (table) => {
    table.dropColumn('type');
  });
}
