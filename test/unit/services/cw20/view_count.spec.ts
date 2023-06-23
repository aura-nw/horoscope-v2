import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import knex from '../../../../src/common/utils/db_connection';
import { Code, Cw20Contract } from '../../../../src/models';

@Describe('Test view count')
export default class TestViewCountHolder {
  codeId = {
    ...Code.fromJson({
      creator: 'code_id_creator',
      code_id: 100,
      data_hash: 'code_id_data_hash',
      instantiate_permission: { permission: '', address: '', addresses: [] },
      store_hash: 'code_id_store_hash',
      store_height: 1000,
      type: 'CW20',
    }),
    contracts: [
      {
        name: 'Base Contract 2',
        address: 'mock_contract_address',
        creator: 'phamphong_creator',
        code_id: 100,
        instantiate_hash: 'abc',
        instantiate_height: 300000,
      },
      {
        code_id: 100,
        address: 'mock_contract_address_2',
        name: 'name',
        creator: 'phamphong_creator 2',
        instantiate_hash: 'abc',
        instantiate_height: 300000,
      },
    ],
  };

  cw20Contract_1 = {
    ...Cw20Contract.fromJson({
      smart_contract_id: 1,
      marketing_info: {},
      total_supply: 1000,
      minter: 'gfhgdfhgdfh',
      track: true,
      last_updated_height: 12454,
    }),
    holders: [
      {
        address: 'holder_1',
        amount: '123134134434',
        last_updated_height: 8000,
      },
      {
        address: 'holder_2',
        amount: '20032204',
        last_updated_height: 8500,
      },
      {
        address: 'holder_3',
        amount: '-1654534',
        last_updated_height: 7000,
      },
      {
        address: 'holder_4',
        amount: '0',
        last_updated_height: 8000,
      },
      {
        address: 'holder_5',
        amount: '-20032204',
        last_updated_height: 8500,
      },
      {
        address: 'holder_6',
        amount: '1654534',
        last_updated_height: 7000,
      },
    ],
  };

  cw20Contract_2 = {
    ...Cw20Contract.fromJson({
      smart_contract_id: 2,
      marketing_info: {},
      total_supply: 1000,
      minter: 'gfhgdfhgdfh',
      track: true,
      last_updated_height: 12454,
    }),
    holders: [],
  };

  @BeforeAll()
  async initSuite() {
    await knex.raw(
      'TRUNCATE TABLE code, cw20_contract RESTART IDENTITY CASCADE'
    );
    await Code.query().insertGraph(this.codeId);
    await Cw20Contract.query().insertGraph(this.cw20Contract_1);
    await Cw20Contract.query().insertGraph(this.cw20Contract_2);
  }

  @AfterAll()
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async tearDown() {}

  @Test('Test view count holder')
  public async testViewCountHolder() {
    const contracts = await knex.from('view_count_holder_cw20');
    expect(contracts.length).toEqual(1);
    expect(
      contracts.find(
        (contract) =>
          contract.contract_address === this.codeId.contracts[0].address
      ).count
    ).toEqual('3');
  }
}
