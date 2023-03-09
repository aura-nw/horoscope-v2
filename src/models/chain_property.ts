import { ICoin } from '../common/types/interfaces';
import BaseModel from './base';

export interface IPool {
  not_bonded_tokens: string;
  bonded_tokens: string;
}

export class ChainProperty extends BaseModel {
  community_pool!: ICoin[];

  inflation!: number;

  pool!: IPool;

  supply!: ICoin[];

  static get tableName() {
    return 'chain_property';
  }

  static get jsonAttributes() {
    return ['community_pool', 'inflation', 'pool', 'supply'];
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['community_pool', 'inflation', 'pool', 'supply'],
      properties: {
        community_pool: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              denom: { type: 'string' },
              amount: { type: 'string' },
            },
          },
        },
        inflation: { type: 'number' },
        pool: {
          type: 'object',
          properties: {
            not_bonded_tokens: { type: 'string' },
            bonded_tokens: { type: 'string' },
          },
        },
        supply: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              denom: { type: 'string' },
              amount: { type: 'string' },
            },
          },
        },
      },
    };
  }
}
