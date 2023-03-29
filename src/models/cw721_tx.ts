import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { CW721Contract } from './cw721_contract';
// eslint-disable-next-line import/no-cycle
import { CW721Token } from './cw721_token';

export interface ICW721Tx {
  id?: number;
  tx_hash: string;
  contract_address: string;
  from: string;
  to: string;
  token_id: string;
  action: string;
  created_at?: Date;
  updated_at?: Date;
}

export class CW721Tx extends BaseModel implements ICW721Tx {
  id?: number;

  action!: string;

  from!: string;

  to!: string;

  token_id!: string;

  tx_hash!: string;

  contract_address!: string;

  created_at?: Date;

  updated_at?: Date;

  static get tableName() {
    return 'cw721_tx';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['tx_hash', 'contract_address'],
      properties: {
        tx_hash: { type: 'string' },
        contract_address: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        action: { type: 'string' },
        token_id: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      token: {
        relation: Model.BelongsToOneRelation,
        modelClass: CW721Token,
        join: {
          from: 'cw721_tx.contract_address',
          to: 'cw721_token.contract_address',
        },
      },
      tx: {
        relation: Model.BelongsToOneRelation,
        modelClass: CW721Contract,
        join: {
          from: 'cw721_tx.contract_address',
          to: 'cw721_token.contract_address',
        },
      },
    };
  }
}
