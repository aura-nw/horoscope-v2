import BaseModel from './base';
import { BlockCheckpoint } from './block_checkpoint';

export class ConfigJob extends BaseModel {
  id!: number;

  job_name!: string;

  // Expected row get for handle when each time job run
  expected_row!: number;

  // Range query by block
  block_range!: number;

  // ABS(rows retrieve - expected_row) should less than acceptance_error, if not do the block_balance below
  acceptance_error!: number;

  // When get rows by block range not fit with expected_row, then increase/decrease block_range for fit with
  block_balance!: number;

  static get tableName() {
    return 'config_jobs';
  }

  /**
   * @description:
   * @param jobName Job name want to query to get config
   * job crawl block complete on that block we want to crawl
   */
  static async getConfigJob(jobName: string): Promise<ConfigJob | undefined> {
    return ConfigJob.query().select('*').where('job_name', jobName).first();
  }

  // Range job will from currentStartBlock to bestEndBlock
  static determineBestRangeBlockForRunJob(
    currentStartBlock: number,
    currentEndBlock: number,
    dependingCheckPointJob: BlockCheckpoint | undefined,
    configJob: ConfigJob | undefined
  ): number {
    let bestEndBlock = currentEndBlock;

    // No config job, then use default config from block checkpoint
    if (!configJob) return bestEndBlock;

    if (dependingCheckPointJob) {
      if (
        currentStartBlock + configJob.block_range <=
        dependingCheckPointJob.height
      ) {
        bestEndBlock = currentStartBlock + configJob.block_range;
      } else {
        bestEndBlock = dependingCheckPointJob.height;
      }
    } else {
      bestEndBlock = currentStartBlock + configJob.block_range;
    }

    return bestEndBlock;
  }

  // Balance config job
  static prepareBalanceJob(
    bestEndBlock: number,
    dependingCheckPointJob: BlockCheckpoint | undefined,
    configJob: ConfigJob | undefined,
    currentTotalRowFetch: number
  ): ConfigJob | null {
    // No job config so keep every thing normal
    if (!configJob) return null;

    // Job depending on another job, so keep current config job
    if (bestEndBlock === dependingCheckPointJob?.height) return null;

    const errorRow = configJob.expected_row - currentTotalRowFetch;
    // error acceptance
    if (Math.abs(errorRow) <= configJob.acceptance_error) return null;

    if (errorRow > 0) {
      // increase range block if total row fetch too low with expected row
      // eslint-disable-next-line no-param-reassign
      configJob.block_range += configJob.block_balance;
    } else {
      // decrease range block if total row fetch too low with expected row
      // eslint-disable-next-line no-param-reassign
      configJob.block_range -= configJob.block_balance;
    }

    return configJob;
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'job_name',
        'expected_row',
        'block_range',
        'acceptance_error',
        'block_balance',
      ],
      properties: {
        id: { type: 'number' },
        job_name: { type: 'string' },
        expected_row: { type: 'number' },
        block_range: { type: 'number' },
        acceptance_error: { type: 'number' },
        block_balance: { type: 'number' },
      },
    };
  }
}
