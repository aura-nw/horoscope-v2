import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { CW20Holder } from './cw20_holder';
// eslint-disable-next-line import/no-cycle
import { Cw20Event } from './cw20_event';
import { SmartContract } from './smart_contract';

export interface ICW20MarketingInfo {
  data: {
    project: string;
    description: string;
    logo: {
      url: string;
    };
    marketing: string;
  };
}
export interface ICW20BalanceInfo {
  data: {
    balance: string;
  };
}

export interface ICW20AssetInfo {
  data: {
    name: string;
    symbol: string;
    decimals: number;
    total_supply: string;
  };
}

export class Cw20Contract extends BaseModel {
  id!: number;

  smart_contract_id!: number;

  asset_info?: ICW20AssetInfo;

  marketing_info?: ICW20MarketingInfo;

  total_supply!: string;

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
