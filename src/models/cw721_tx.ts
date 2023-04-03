import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import CW721Contract from './cw721_contract';
// eslint-disable-next-line import/no-cycle
import CW721Token from './cw721_token';

export default class CW721Tx extends BaseModel {
  id?: number;

  action?: string;

  sender?: string;

  id_token?: number;

  txhash!: string;

  contract_address!: string;

  created_at?: Date;

  updated_at?: Date;

  static get tableName() {
    return 'cw721_tx';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['txhash', 'contract_address'],
      properties: {
        txhash: { type: 'string' },
        contract_address: { type: 'string' },
        sender: { type: 'string' },
        action: { type: 'string' },
        token_id: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      relate_token: {
        relation: Model.BelongsToOneRelation,
        modelClass: CW721Token,
        join: {
          from: 'cw721_tx.id_token',
          to: 'cw721_token.id',
        },
      },
      relate_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: CW721Contract,
        join: {
          from: 'cw721_tx.contract_address',
          to: 'cw721_contract.address',
        },
      },
    };
  }
}
