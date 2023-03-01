import { Model } from 'objection';
import BaseModel from './BaseModel';

export interface BlockSignature {
  height: number;
  block_id_flag: number;
  validator_address: string;
  timestamp: Date;
  signature: string;
}

export class BlockSignature extends BaseModel implements BlockSignature {
  height!: number;

  block_id_flag!: number;

  validator_address!: string;

  timestamp!: Date;

  signature!: string;

  static get tableName() {
    return 'block_signature';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      properties: {
        block_id: { type: 'number' },
        block_id_flag: { type: 'number' },
        validator_address: { type: 'string' },
        timestamp: { type: 'timestamp' },
        signature: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      owner: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'block',
        join: {
          from: 'block_signature.block_id',
          to: 'block.id',
        },
      },
    };
  }
}
