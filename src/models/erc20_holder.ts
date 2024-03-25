import { Model } from 'objection';
import BaseModel from './base';
import { Erc20Contract } from './erc20_contract';
// eslint-disable-next-line import/no-cycle

export class Erc20Holder extends BaseModel {
  static softDelete = false;

  [relation: string]: any;

  id?: number;

  address!: string;

  amount!: string;

  last_updated_height!: number;

  erc20_contract_address!: string;

  static get tableName() {
    return 'erc20_holder';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['amount', 'address'],
      properties: {
        erc20_contract_address: { type: 'string' },
        address: { type: 'string' },
        amount: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      erc20_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: Erc20Contract,
        join: {
          from: 'cw20_holder.erc20_contract_address',
          to: 'erc20_contract.address',
        },
      },
    };
  }
}
