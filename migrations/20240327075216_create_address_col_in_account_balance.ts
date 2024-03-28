import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account_balance', (table) => {
    table.string('address').index();
  });
  let done = false;
  let startId = 0;
  let chunkSizeQuery = 10000;
  while (!done) {
    console.log(`update account in account_balance at id ${startId}`);
    const result = await knex.raw(
      `select account_balance.id, account.address from account_balance join account on account_balance.account_id = account.id where account_balance.id > ${startId} order by account_balance.id asc limit ${chunkSizeQuery}`
    );
    if (result.rows.length === 0) {
      done = true;
      break;
    }
    const stringListUpdates = result.rows
      .map((update: any) => `(${update.id}, '${update.address}')`)
      .join(',');
    await knex.raw(
      `UPDATE account_balance set address = temp.address from (VALUES ${stringListUpdates}) as temp(id, address) where temp.id = account_balance.id`
    );
    startId = result.rows[result.rows.length - 1].id;
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account_balance', (table) => {
    table.dropColumn('address');
  });
}
