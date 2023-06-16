import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import CW721Token from './cw721_token';
// eslint-disable-next-line import/no-cycle
import CW721Activity from './cw721_tx';
import { SmartContract } from './smart_contract';

export default class CW721Contract extends BaseModel {
  [relation: string]: any;

  contract_id!: number;

  symbol?: string;

  minter?: string;

  id!: number;

  name?: string;

  track?: boolean;

  created_at?: Date;

  updated_at?: Date;

  static get tableName() {
    return 'cw721_contract';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['contract_id'],
      properties: {
        contract_id: { type: 'number' },
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
      smart_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: SmartContract,
        join: {
          from: 'cw721_contract.contract_id',
          to: 'smart_contract.id',
        },
      },
    };
  }
}
