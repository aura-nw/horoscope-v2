import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import knex from '../../../../src/common/utils/db_connection';
import { CW721Contract } from '../../../../src/models/cw721_contract';
import { Code } from '../../../../src/models';

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
      type: 'CW721',
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

  cw721Contract = {
    ...CW721Contract.fromJson({
      contract_id: 1,
      symbol: '',
      name: 'jghdfgkjdfgjk',
      track: true,
    }),
    tokens: [
      {
        token_id: 'bhlvjdfkljkljg',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 122120,
        burned: true,
        cw721_contract_id: 1,
      },
      {
        token_id: 'zzzvcxxb',
        owner: 'xctgxgvxcgxx',
        last_updated_height: 155,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'vbmnnmn',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 42424,
        burned: true,
        cw721_contract_id: 1,
      },
      {
        token_id: 'vcgasdfsdg',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 121012,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'cbvcxbvcxgbdv',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 651651,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'dghdfghdfgfdgdf',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 2314,
        burned: false,
        cw721_contract_id: 1,
      },
    ],
  };

  @BeforeAll()
  async initSuite() {
    await knex.raw(
      'TRUNCATE TABLE code, cw721_contract RESTART IDENTITY CASCADE'
    );
    await Code.query().insertGraph(this.codeId);
    await CW721Contract.query().insertGraph(this.cw721Contract);
  }

  @AfterAll()
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async tearDown() {}

  @Test('Test view count holder')
  public async testViewCountHolder() {
    const holders = await knex.from('view_count_holder_cw721');
    expect(holders.length).toEqual(2);
    expect(
      holders.find(
        (holder) => holder.owner === this.cw721Contract.tokens[0].owner
      ).count
    ).toEqual('3');
    expect(
      holders.find(
        (holder) => holder.owner === this.cw721Contract.tokens[1].owner
      ).count
    ).toEqual('1');
  }
}
