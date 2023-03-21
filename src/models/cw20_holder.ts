import { Model } from 'objection';
import BaseModel from './base';
import { CW20Token } from './cw20_token';

export interface ICW20Holder {
  id?: number;
  address: string;
  balance: string;
  contract_address: string;
  created_at?: Date;
  updated_at?: Date;
}
export class CW20Holder extends BaseModel implements ICW20Holder {
  id?: number;

  contract_address!: string;

  address!: string;

  balance!: string;

  created_at?: Date;

  updated_at?: Date;

  static get tableName() {
    return 'cw20_holder';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['balance', 'contract_address', 'address'],
      properties: {
        contract_address: { type: 'string' },
        address: { type: 'string' },
        balance: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      token: {
        relation: Model.BelongsToOneRelation,
        modelClass: CW20Token,
        join: {
          from: 'cw20_holder.contract_address',
          to: 'cw20_token.contract_address',
        },
      },
    };
  }
}
