import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import CW721Token from './cw721_token';
// eslint-disable-next-line import/no-cycle
import CW721Activity from './cw721_tx';

export default class CW721Contract extends BaseModel {
  [relation: string]: any;

  code_id!: number;

  address!: string;

  name?: string;

  symbol?: string;

  minter?: string;

  creator?: string;

  id?: number;

  created_at?: Date;

  updated_at?: Date;

  static get tableName() {
    return 'cw721_contract';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['code_id', 'address'],
      properties: {
        code_id: { type: 'number' },
        address: { type: 'string' },
        minter: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      tokens: {
        relation: Model.HasManyRelation,
        modelClass: CW721Token,
        join: {
          from: 'cw721_contract.id',
          to: 'cw721_token.cw721_contract_id',
        },
      },
      activities: {
        relation: Model.HasManyRelation,
        modelClass: CW721Activity,
        join: {
          from: 'cw721_contract.id',
          to: 'cw721_activity.cw721_contract_id',
        },
      },
    };
  }
}
