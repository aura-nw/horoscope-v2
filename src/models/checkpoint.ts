import BaseModel from './base';

export interface ICheckpoint {
  id?: number;
  job_name: string;
  data: JSON;
}

export class Checkpoint extends BaseModel {
  job_name!: string;

  data!: JSON;

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
