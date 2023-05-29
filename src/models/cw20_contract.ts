import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { CW20Holder } from './cw20_holder';
// eslint-disable-next-line import/no-cycle
import { Cw20Event } from './cw20_activity';
import { SmartContract } from './smart_contract';

export class Cw20Contract extends BaseModel {
  id!: number;

  smart_contract_id!: number;

  marketing_info?: any;

  total_supply!: string;

  symbol?: string;

  decimal?: number;

  minter?: string;

  name?: string;

  static get tableName() {
    return 'cw20_contract';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['contract_address', 'total_supply'],
      properties: {
        total_supply: { type: 'string' },
        asset_info: { type: 'object' },
        contract_id: { type: 'number' },
        marketing_info: { type: 'object' },
        name: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      smart_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: SmartContract,
        join: {
          to: 'smart_contract.id',
          from: 'cw20_contract.smart_contract_id',
        },
      },
      holders: {
        relation: Model.HasManyRelation,
        modelClass: CW20Holder,
        join: {
          from: 'cw20_contract.id',
          to: 'cw20_holder.cw20_contract_id',
        },
      },
      events: {
        relation: Model.HasManyRelation,
        modelClass: Cw20Event,
        join: {
          from: 'cw20_contract.id',
          to: 'cw20_event.cw20_contract_id',
        },
      },
    };
  }
}
