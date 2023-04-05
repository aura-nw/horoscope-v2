import { BeforeAll, Describe, Test } from '@jest-decorated/core';
import { Checkpoint, ICheckpoint } from '../../../src/models';
import knex from '../../../src/common/utils/db_connection';

@Describe('Test checkpoint model')
export default class CW20HoldersTest {
  checkpointTx: ICheckpoint = {
    job_name: 'BullJobTx',
    data: { checkpointX: 'value1', checkpointY: 2 },
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

  @Test('Update success')
  public async testUpdate() {
    await Checkpoint.query()
      .patch({ data: { checkpointX: 'value2', checkpointY: 3 } })
      .where('job_name', 'BullJobTx');
    const result = await Checkpoint.query()
      .where('job_name', 'BullJobTx')
      .first();
    expect(result).not.toBeUndefined();
    expect(result?.data.checkpointX).toBe('value2');
    expect(result?.data.checkpointY).toBe(3);
  }
}
