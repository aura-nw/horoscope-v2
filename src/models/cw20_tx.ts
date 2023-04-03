import { Model } from 'objection';
import BaseModel from './base';
import { CW20Token } from './cw20_token';

export interface ICW20Tx {
  id?: number;
  txhash: string;
  contract_address: string;
  from: string;
  to: string;
  amount: string;
  action: string;
  created_at?: Date;
  updated_at?: Date;
}

export class CW20Tx extends BaseModel implements ICW20Tx {
  id?: number;

  action!: string;

  from!: string;

  to!: string;

  amount!: string;

  txhash!: string;

  contract_address!: string;

  created_at?: Date;

  updated_at?: Date;

  static get tableName() {
    return 'cw20_tx';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['txhash', 'contract_address'],
      properties: {
        txhash: { type: 'string' },
        contract_address: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        action: { type: 'string' },
        amount: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      token: {
        relation: Model.BelongsToOneRelation,
        modelClass: CW20Token,
        join: {
          from: 'cw20_tx.contract_address',
          to: 'cw20_token.contract_address',
        },
      },
    };
  }
}
