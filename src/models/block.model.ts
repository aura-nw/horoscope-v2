import { Model } from 'objection';
import BaseModel from './BaseModel';

export interface Block {
  height: number;
  hash: string;
  time: Date;
  proposer_address: string;
  data: JSON;
}

export class Block extends BaseModel implements Block {
  height!: number;

  hash!: string;

  time!: Date;

  proposer_address!: string;

  data!: JSON;

  static get tableName() {
    return 'block';
  }

  static get jsonAttributes() {
    return ['data'];
  }

  static get jsonSchema() {
    return {
      type: 'object',
      properties: {
        height: { type: 'number' },
        hash: { type: 'string', minLength: 1, maxLength: 255 },
        time: { type: 'timestamp' },
        proposer_address: { type: 'string', minLength: 1, maxLength: 255 },
        data: {
          type: 'object',
          patternProperties: {
            '^.*$': {
              anyOf: [{ type: 'string' }, { type: 'number' }],
            },
          },
        },
      },
    };
  }

  static get relationMappings() {
    return {
      signatures: {
        relation: Model.HasManyRelation,
        modelClass: 'block_signature',
        join: {
          from: 'block.id',
          to: 'block_signature.block_id',
        },
      },
    };
  }
}
