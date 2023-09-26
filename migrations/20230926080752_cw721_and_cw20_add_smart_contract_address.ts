import { Knex } from 'knex';
import CW721Contract from '../src/models/cw721_contract';
import _ from 'lodash';
import { Cw20Contract } from '../src/models';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_contract', (table) => {
    table.string('smart_contract_address');
  });
  await knex.schema.alterTable('cw20_contract', (table) => {
    table.string('smart_contract_address');
  });
  await knex.transaction(async (trx) => {
    const cw721Contracts = await CW721Contract.query()
      .transacting(trx)
      .withGraphFetched('smart_contract');
    if (cw721Contracts.length > 0) {
      cw721Contracts.forEach((cw721Contract) => {
        cw721Contract.smart_contract_address =
          cw721Contract.smart_contract.address;
      });
      await CW721Contract.query()
        .transacting(trx)
        .insert(
          cw721Contracts.map((cw721Contract) =>
            _.omit(cw721Contract, 'smart_contract')
          )
        )
        .onConflict('id')
        .merge();
    }
    const cw20Contracts = await Cw20Contract.query()
      .transacting(trx)
      .withGraphFetched('smart_contract');
    if (cw20Contracts.length > 0) {
      cw20Contracts.forEach((cw20Contract) => {
        cw20Contract.smart_contract_address =
          cw20Contract.smart_contract.address;
      });
      await Cw20Contract.query()
        .transacting(trx)
        .insert(
          cw20Contracts.map((cw20Contract) =>
            _.omit(cw20Contract, 'smart_contract')
          )
        )
        .onConflict('id')
        .merge();
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cw721_contract', (table) => {
    table.dropColumn('smart_contract_address');
  });
  await knex.schema.alterTable('cw20_contract', (table) => {
    table.dropColumn('smart_contract_address');
  });
}
