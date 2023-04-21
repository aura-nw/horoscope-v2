/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { CodeId } from './code_id';

export class SmartContract extends BaseModel {
  id!: number;

  name: string | undefined;

  address!: string;

  creator!: string;

  code_id!: number;

  instantiate_hash!: string;

  instantiate_height!: number;

  version: string | undefined;

  static get tableName() {
    return 'smart_contract';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'address',
        'creator',
        'code_id',
        'instantiate_hash',
        'instantiate_height',
      ],
      properties: {
        name: { type: ['string', 'null'] },
        address: { type: 'string' },
        creator: { type: 'string' },
        code_id: { type: 'number' },
        instantiate_hash: { type: 'string' },
        instantiate_height: { type: 'number' },
        version: { type: ['string', 'null'] },
      },
    };
  }

  static get relationMappings() {
    return {
      code_id: {
        relation: Model.BelongsToOneRelation,
        modelClass: CodeId,
        join: {
          from: 'smart_contract.code_id',
          to: 'code_id.code_id',
        },
      },
    };
  }
}
