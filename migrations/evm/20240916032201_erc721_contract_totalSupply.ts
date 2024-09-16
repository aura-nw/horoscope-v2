import { Knex } from 'knex';
import { Erc721Token } from '../../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc721_contract', (table) => {
    table.integer('total_supply').defaultTo(0).index();
  });
  await knex.raw(`set statement_timeout to 0`);
  const totalSupplies = await Erc721Token.query(knex)
    .select('erc721_token.erc721_contract_address')
    .count()
    .groupBy('erc721_token.erc721_contract_address');
  if (totalSupplies.length > 0) {
    const stringListUpdates = totalSupplies
      .map(
        (totalSuply) =>
          `('${totalSuply.erc721_contract_address}', ${totalSuply.count})`
      )
      .join(',');
    await knex.raw(
      `UPDATE erc721_contract SET total_supply = temp.total_supply from (VALUES ${stringListUpdates}) as temp(address, total_supply) where temp.address = erc721_contract.address`
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('erc721_contract', (table) => {
    table.dropColumn('total_supply');
  });
}
