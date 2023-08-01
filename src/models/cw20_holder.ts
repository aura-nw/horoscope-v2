import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { Cw20Contract } from './cw20_contract';
import { SmartContract } from './smart_contract';

export class CW20Holder extends BaseModel {
  static softDelete = false;

  [relation: string]: any;

  id?: number;

  address!: string;

  amount!: string;

  last_updated_height!: number;

  cw20_contract_id!: number;

  static get tableName() {
    return 'cw20_holder';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['amount', 'address'],
      properties: {
        cw20_contract_id: { type: 'number' },
        address: { type: 'string' },
        amount: { type: 'string' },
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
      smart_contract: {
        relation: Model.HasOneThroughRelation,
        modelClass: SmartContract,
        join: {
          from: 'cw20_holder.cw20_contract_id',
          to: 'smart_contract.id',
          through: {
            from: 'cw20_contract.id',
            to: 'cw20_contract.smart_contract_id',
          },
        },
      },
    };
  }
}
