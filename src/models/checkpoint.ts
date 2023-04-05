import BaseModel from './base';

export interface ICheckpoint {
  job_name: string;
  data: any;
}

export class Checkpoint extends BaseModel implements ICheckpoint {
  job_name!: string;

  data!: any;

  static get tableName() {
    return 'checkpoint';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['job_name', 'data'],
      properties: {
        job_name: { type: 'string' },
      },
    };
  }
}
