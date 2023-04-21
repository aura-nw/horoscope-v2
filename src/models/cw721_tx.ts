import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import CW721Contract from './cw721_contract';
import CW721Token from './cw721_token';

export default class CW721Activity extends BaseModel {
  id?: number;

  action?: string;

  sender?: string;

  tx_hash!: string;

  cw721_contract_id!: number;

  cw721_token_id?: number;

  created_at?: Date;

  updated_at?: Date;

  from?: string;

  to?: string;

  static get tableName() {
    return 'cw721_activity';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['tx_hash', 'cw721_contract_id'],
      properties: {
        tx_hash: { type: 'string' },
        cw721_contract_id: { type: 'number' },
        sender: { type: 'string' },
        action: { type: 'string' },
        cw721_token_id: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      relate_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: CW721Contract,
        join: {
          from: 'cw721_activity.cw721_contract_id',
          to: 'cw721_contract.id',
        },
      },
      relate_token: {
        relation: Model.BelongsToOneRelation,
        modelClass: CW721Token,
        join: {
          from: 'cw721_activity.cw721_token_id',
          to: 'cw721_token.id',
        },
      },
    };
  }
}
