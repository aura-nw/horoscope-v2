import { BeforeAll, Describe, Test } from '@jest-decorated/core';
import { BlockCheckpoint } from '../../../src/models';
import knex from '../../../src/common/utils/db_connection';

@Describe('Test checkpoint model')
export default class CW20HoldersTest {
  blockCheckpoint = [
    {
      job_name: 'job1',
      height: 1,
    },
    {
      job_name: 'job2',
      height: 19,
    },
    {
      job_name: 'job3',
      height: 10,
    },
    {
      job_name: 'job4',
      height: 9,
    },
    {
      job_name: 'job5',
      height: 110,
    },
  ];

  @BeforeAll()
  async initSuite() {
    await knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE');
    await BlockCheckpoint.query().insert(
      this.blockCheckpoint.map((blockCheckpoint) =>
        BlockCheckpoint.fromJson(blockCheckpoint)
      )
    );
  }

  @Test('get Checkpoint')
  public async testQuery() {
    const result = await BlockCheckpoint.getCheckpoint(
      this.blockCheckpoint[0].job_name,
      [
        this.blockCheckpoint[1].job_name,
        this.blockCheckpoint[2].job_name,
        this.blockCheckpoint[3].job_name,
        this.blockCheckpoint[4].job_name,
      ]
    );
    expect(result[0]).toEqual(this.blockCheckpoint[0].height);
    expect(result[1]).toEqual(this.blockCheckpoint[3].height);
  }
}
