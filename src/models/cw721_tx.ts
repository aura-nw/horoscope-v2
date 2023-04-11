import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import CW721Contract from './cw721_contract';

export default class CW721Tx extends BaseModel {
  id?: number;

  action?: string;

  sender?: string;

  txhash!: string;

  contract_address!: string;

  token_id?: string;

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
