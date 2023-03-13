import BaseModel from './base';

export default class IBCDenom extends BaseModel {
  path!: string;

  base_denom!: string;

  hash!: string;

  static get tableName() {
    return 'ibc_denom';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['path', 'base_denom', 'hash'],
      properties: {
        path: { type: 'string' },
        base_denom: { type: 'string' },
        hash: { type: 'string' },
      },
    };
  }
}
