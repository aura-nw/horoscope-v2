import { Model } from 'objection';
import BaseModel from './base';
import { Cw20Contract } from './cw20_contract';

export class CW20TotalHolderStats extends BaseModel {
  [relation: string]: any;

  date!: Date;

  cw20_contract_id!: number;

  total_holder!: number;

  static get tableName() {
    return 'cw20_total_holder_stats';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['cw20_contract_id', 'total_holder', 'date'],
      properties: {
        cw20_contract_id: { type: 'number' },
        total_holder: { type: 'number' },
        date: { type: 'object' },
      },
    };
  }

  static get relationMappings() {
    return {
      cw20_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: Cw20Contract,
        join: {
          from: 'cw20_total_holder_stats.cw20_contract_id',
          to: 'cw20_contract.id',
        },
      },
    };
  }
}
