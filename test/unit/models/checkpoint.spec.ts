import { BeforeAll, Describe, Test } from '@jest-decorated/core';
import knex from '../../../src/common/utils/db_connection';
import { Checkpoint, ICheckpoint } from '../../models/checkpoint';

@Describe('Test checkpoint model')
export default class CW20HoldersTest {
  checkpointTx: ICheckpoint = {
    job_name: 'BullJobTx',
    data: {
      checkpointX: 'value1',
      checkpointY: 2,
    },
  };

  @BeforeAll()
  async initSuite() {
    await knex.raw('TRUNCATE TABLE checkpoint RESTART IDENTITY CASCADE');
    await Checkpoint.query().insert(this.checkpointTx);
  }

  @Test('Query success')
  public async testQuery() {
    const result = await Checkpoint.query().first();
    expect(result).not.toBeUndefined();
    expect(result?.job_name).toBe('BullJobTx');
    expect(result?.data.checkpointX).toBe('value1');
  }

  // @Test('Update success')
  // public async testUpdate() {
  //   await CW20Holder.query()
  //     .patch({ address: 'phamphong' })
  //     .where('address', mockHolderAddress[0]);
  //   const holder = await CW20Holder.query()
  //     .where('address', 'phamphong')
  //     .first();
  //   expect(holder).not.toBeUndefined();
  // }

  // @Test('Insert success')
  // public async testInsert() {
  //   await CW20Holder.query().insert({
  //     address: mockHolderAddress[1],
  //     balance: '100000000000000000000000000000000000000',
  //     contract_address: mockTokenAddress[1],
  //   });
  //   const holder = await CW20Holder.query()
  //     .where('address', mockHolderAddress[1])
  //     .first();
  //   expect(holder).not.toBeUndefined();
  // }

  // @Test('Insert balance null fail')
  // public async testInsertBalanceNullFail() {
  //   await expect(
  //     CW20Holder.query().insert({
  //       address: mockHolderAddress[1],
  //       contract_address: mockTokenAddress[0],
  //     })
  //   ).rejects.toBeInstanceOf(ValidationError);
  // }

  // @Test('Query relation success')
  // public async testQueryRelation() {
  //   const token = (await CW20Holder.relatedQuery('token')
  //     .for([2])
  //     .first()) as CW20Token;
  //   expect(token.code_id).toBe(this.token[1].code_id);
  // }
}
