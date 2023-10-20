import { Model } from 'objection';
import BaseModel from './base';

export class BlockSignature extends BaseModel {
  height!: number;

  block_id_flag!: number;

  validator_address!: string;

  timestamp!: Date;

  static get tableName() {
    return 'block_signature';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['height', 'block_id_flag', 'validator_address', 'timestamp'],
      properties: {
        height: { type: 'number' },
        block_id_flag: { type: 'number' },
        validator_address: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    };
  }

  static get relationMappings() {
    return {
      owner: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'block',
        join: {
          from: 'block_signature.height',
          to: 'block.height',
        },
      },
    };
  }
}
