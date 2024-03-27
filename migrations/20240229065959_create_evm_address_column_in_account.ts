import { Knex } from 'knex';
import { convertBech32AddressToEthAddress } from '../src/services/evm/utils';
import config from '../config.json' assert { type: 'json' };
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account', (table) => {
    table.string('evm_address').unique().index();
    table.string('code_hash').index();
  });
  let done = false;
  let startId = 0;
  let chunkSizeQuery = 10000;
  while (!done) {
    console.log(`update evm_address in account table at id ${startId}`);
    const addresses = await knex.raw(
      `select * from account where id > ${startId} order by id asc limit ${chunkSizeQuery}`
    );
    if (addresses.rows.length === 0) {
      done = true;
      break;
    }
    const stringListUpdates = addresses.rows
      .map(
        (update: any) =>
          `(${update.id}, '${convertBech32AddressToEthAddress(
            config.networkPrefixAddress,
            update.address
          ).toLowerCase()}')`
      )
      .join(',');
    await knex.raw(
      `UPDATE account set evm_address = temp.evm_address from (VALUES ${stringListUpdates}) as temp(id, evm_address) where temp.id = account.id`
    );
    startId = addresses.rows[addresses.rows.length - 1].id;
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('account', (table) => {
    table.dropColumn('evm_address');
    table.dropColumn('code_hash');
  });
}
