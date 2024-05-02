import { Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { ConfigJob, BlockCheckpoint } from '../../../src/models';

@Describe('Test cw721 admin api service')
export default class Cw721AdminTest {
  broker = new ServiceBroker({
    logger: false,
  });

  private mockBlockCheckPoint(
    jobName: string,
    expectedHeight: number
  ): BlockCheckpoint {
    const newBlockCheckpoint = new BlockCheckpoint();
    newBlockCheckpoint.job_name = jobName;
    newBlockCheckpoint.height = expectedHeight;
    return newBlockCheckpoint;
  }

  private mockConfigJob(
    jobName: string,
    expectedRow: number,
    blockRange: number,
    acceptanceError: number,
    blockBalance: number
  ): ConfigJob {
    const newConfigJob = new ConfigJob();
    newConfigJob.job_name = jobName;
    newConfigJob.expected_row = expectedRow;
    newConfigJob.block_range = blockRange;
    newConfigJob.acceptance_error = acceptanceError;
    newConfigJob.block_balance = blockBalance;
    newConfigJob.is_sync = true;
    return newConfigJob;
  }

  @Test('Test get best end block with no config job')
  public async test1() {
    const startBlock = 1;
    const endBlock = 100;
    const bestEndBlock = ConfigJob.determineBestRangeBlockForRunJob(
      startBlock,
      endBlock,
      undefined,
      undefined
    );
    expect(bestEndBlock).toBe(endBlock);
  }

  @Test(
    'Test get best end block with depend block checkpoint and no config job'
  )
  public async test2() {
    const startBlock = 1;
    const endBlock = 100;
    const dependBlockCheckPoint = this.mockBlockCheckPoint(
      'exampleDependingJob',
      50
    );

    const bestEndBlock = ConfigJob.determineBestRangeBlockForRunJob(
      startBlock,
      endBlock,
      dependBlockCheckPoint,
      undefined
    );

    expect(bestEndBlock).toBe(endBlock);
  }

  @Test(
    'Test get best end block with config job and no depend block checkpoint'
  )
  public async test3() {
    const startBlock = 1;
    const endBlock = 100;
    const configJob = this.mockConfigJob('exampleConfigJob', 1000, 50, 100, 10);

    const bestEndBlock = ConfigJob.determineBestRangeBlockForRunJob(
      startBlock,
      endBlock,
      undefined,
      configJob
    );

    expect(bestEndBlock).toBe(startBlock + configJob.block_range);
  }

  @Test('Test get best end block with config job and depend block checkpoint')
  public async test4() {
    const startBlock = 1;
    const endBlock = 100;
    const configJob = this.mockConfigJob('exampleConfigJob', 1000, 50, 100, 10);
    const dependBlockCheckPoint = this.mockBlockCheckPoint(
      'exampleDependingJob',
      40
    );

    const bestEndBlock = ConfigJob.determineBestRangeBlockForRunJob(
      startBlock,
      endBlock,
      dependBlockCheckPoint,
      configJob
    );

    expect(bestEndBlock).toBe(dependBlockCheckPoint.height);
  }

  @Test('Test config job with no sync')
  public async test5() {
    const startBlock = 1;
    const endBlock = 100;
    const configJob = this.mockConfigJob('exampleConfigJob', 1000, 50, 100, 10);
    configJob.is_sync = false;
    const dependBlockCheckPoint = this.mockBlockCheckPoint(
      'exampleDependingJob',
      50
    );
    const bestEndBlock = ConfigJob.determineBestRangeBlockForRunJob(
      startBlock,
      endBlock,
      dependBlockCheckPoint,
      configJob
    );
    expect(bestEndBlock).toBe(endBlock);
  }

  @Test('Test prepare balance job with config not sync')
  public async test6() {
    const bestEndBlock = 100;
    const configJob = this.mockConfigJob('exampleConfigJob', 1000, 50, 100, 10);
    configJob.is_sync = false;
    const dependBlockCheckPoint = this.mockBlockCheckPoint(
      'exampleDependingJob',
      500
    );
    const result = ConfigJob.prepareBalanceJob(
      bestEndBlock,
      dependBlockCheckPoint,
      configJob,
      100
    );
    expect(result).toBe(null);
  }

  @Test('Test prepare balance job need to increase range')
  public async test7() {
    const bestEndBlock = 100;
    const baseBlockRange = 50;
    const balanceBlock = 10;
    const configJob = this.mockConfigJob(
      'exampleConfigJob',
      1000,
      baseBlockRange,
      100,
      balanceBlock
    );
    const dependBlockCheckPoint = this.mockBlockCheckPoint(
      'exampleDependingJob',
      500
    );
    const result = ConfigJob.prepareBalanceJob(
      bestEndBlock,
      dependBlockCheckPoint,
      configJob,
      100
    );
    expect(result).toBeDefined();
    expect(result?.block_range).toEqual(baseBlockRange + balanceBlock);
  }

  @Test('Test prepare balance job need to keep config')
  public async test8() {
    const bestEndBlock = 100;
    const baseBlockRange = 50;
    const balanceBlock = 10;
    const configJob = this.mockConfigJob(
      'exampleConfigJob',
      1000,
      baseBlockRange,
      100,
      balanceBlock
    );
    const dependBlockCheckPoint = this.mockBlockCheckPoint(
      'exampleDependingJob',
      100
    );
    const result = ConfigJob.prepareBalanceJob(
      bestEndBlock,
      dependBlockCheckPoint,
      configJob,
      100
    );
    expect(result).toBe(null);
  }

  @Test('Test prepare balance job need to decrease')
  public async test9() {
    const bestEndBlock = 100;
    const baseBlockRange = 50;
    const balanceBlock = 10;
    const configJob = this.mockConfigJob(
      'exampleConfigJob',
      1000,
      baseBlockRange,
      100,
      balanceBlock
    );
    const dependBlockCheckPoint = this.mockBlockCheckPoint(
      'exampleDependingJob',
      500
    );
    const result = ConfigJob.prepareBalanceJob(
      bestEndBlock,
      dependBlockCheckPoint,
      configJob,
      1200
    );
    expect(result).toBeDefined();
    expect(result?.block_range).toBe(baseBlockRange - balanceBlock);
  }

  @Test('Test prepare balance job need to keep because acceptance error')
  public async test10() {
    const bestEndBlock = 100;
    const baseBlockRange = 50;
    const balanceBlock = 10;
    const configJob = this.mockConfigJob(
      'exampleConfigJob',
      1000,
      baseBlockRange,
      100,
      balanceBlock
    );
    const dependBlockCheckPoint = this.mockBlockCheckPoint(
      'exampleDependingJob',
      500
    );
    const result = ConfigJob.prepareBalanceJob(
      bestEndBlock,
      dependBlockCheckPoint,
      configJob,
      1100
    );
    expect(result).toBe(null);
  }
}
