import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { Cw20Contract } from './cw20_contract';

export class CW20Holder extends BaseModel {
  id?: number;

  address!: string;

  balance!: string;

  cw20_contract_id!: number;

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
        modelClass: Cw20Contract,
        join: {
          from: 'cw20_holder.cw20_contract_id',
          to: 'cw20_contract.id',
        },
      },
    };
  }
}
