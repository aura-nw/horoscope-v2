import BaseModel from './base';

export enum StatisticKey {
  TotalTransaction = 'total_transaction',
}

export class Statistic extends BaseModel {
  key!: StatisticKey;

  value!: number;

  statistic_since!: string;

  updated_at?: Date;

  static get tableName() {
    return 'statistics';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['key', 'value', 'statistic_since'],
      properties: {
        key: { type: 'string' },
        value: { type: 'number' },
        statistic_since: { type: 'string' },
      },
    };
  }

  $beforeInsert() {
    this.updated_at = new Date();
  }

  $beforeUpdate(): void {
    this.updated_at = new Date();
  }
}
