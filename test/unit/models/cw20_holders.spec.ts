import { BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ValidationError } from 'objection';
import { CW20Token, ICW20Token } from '../../../src/models/cw20_token';
import knex from '../../../src/common/utils/db-connection';
import { CW20Holder, ICW20Holder } from '../../../src/models/cw20_holder';

const mockBalance = '1000000000000000000000000000000000000000123';
const mockTokenAddress = ['aura546543213241564', 'aura9844122522144'];
const mockHolderAddress = ['aura122222', 'aura33333333'];
@Describe('Test cw20_holders model')
export default class CW20HoldersTest {
  holder: ICW20Holder = {
    address: mockHolderAddress[0],
    balance: mockBalance,
    contract_address: mockTokenAddress[0],
  };

  token: ICW20Token[] = [
    {
      code_id: '1',
      asset_info: {
        data: { name: '', symbol: '', decimals: 10, total_supply: '' },
      },
      contract_address: mockTokenAddress[0],
      marketing_info: {
        data: {
          project: '',
          description: '',
          logo: { url: '' },
          marketing: '',
        },
      },
    },
    {
      code_id: '2',
      asset_info: {
        data: { name: '', symbol: '', decimals: 10, total_supply: '' },
      },
      contract_address: mockTokenAddress[1],
      marketing_info: {
        data: {
          project: '',
          description: '',
          logo: { url: '' },
          marketing: '',
        },
      },
    },
  ];

  @BeforeAll()
  async initSuite() {
    await knex.raw(
      'TRUNCATE TABLE cw20_holder, cw20_token RESTART IDENTITY CASCADE'
    );
    await CW20Token.query().insert(this.token);
    await CW20Holder.query().insert(this.holder);
  }

  @Test('Query success')
  public async testQuery() {
    const holder = await CW20Holder.query().first();
    expect(holder).not.toBeUndefined();
    expect(holder?.address).toBe(mockHolderAddress[0]);
    expect(holder?.balance).toBe('1000000000000000000000000000000000000000123');
  }

  @Test('Update success')
  public async testUpdate() {
    await CW20Holder.query()
      .patch({ address: 'phamphong' })
      .where('address', mockHolderAddress[0]);
    const holder = await CW20Holder.query()
      .where('address', 'phamphong')
      .first();
    expect(holder).not.toBeUndefined();
  }

  @Test('Insert success')
  public async testInsert() {
    await CW20Holder.query().insert({
      address: mockHolderAddress[1],
      balance: '100000000000000000000000000000000000000',
      contract_address: mockTokenAddress[1],
    });
    const holder = await CW20Holder.query()
      .where('address', mockHolderAddress[1])
      .first();
    expect(holder).not.toBeUndefined();
  }

  @Test('Insert balance null fail')
  public async testInsertBalanceNullFail() {
    await expect(
      CW20Holder.query().insert({
        address: mockHolderAddress[1],
        contract_address: mockTokenAddress[0],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  }

  @Test('Query relation success')
  public async testQueryRelation() {
    const token = (await CW20Holder.relatedQuery('token')
      .for([2])
      .first()) as CW20Token;
    expect(token.code_id).toBe(this.token[1].code_id);
  }
}
