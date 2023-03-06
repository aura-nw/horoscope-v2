import { Model } from 'objection';
import BaseModel from './base.model';

export default class Block extends BaseModel {
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
      required: ['height', 'hash', 'time', 'proposer_address', 'data'],
      properties: {
        height: { type: 'number' },
        hash: { type: 'string', minLength: 1, maxLength: 255 },
        time: { type: 'timestamp' },
        proposer_address: { type: 'string', minLength: 1, maxLength: 255 },
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
      txs: {
        relation: Model.HasManyRelation,
        modelClass: 'transaction',
        join: {
          from: 'block.height',
          to: 'transaction.height',
        },
      },
    };
  }
}
