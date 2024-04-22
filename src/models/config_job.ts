import BaseModel from './base';

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
