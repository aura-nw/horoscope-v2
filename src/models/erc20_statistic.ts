import { Model } from 'objection';
import BaseModel from './base';
import { Erc20Contract } from './erc20_contract';

export class Erc20Statistic extends BaseModel {
  static softDelete = false;

  [relation: string]: any;

  date!: Date;

  erc20_contract_id!: number;

  total_holder!: number;

  static get tableName() {
    return 'erc20_statistic';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['erc20_contract_id', 'total_holder', 'date'],
      properties: {
        erc20_contract_id: { type: 'number' },
        total_holder: { type: 'number' },
        date: { type: 'object' },
      },
    };
  }

  static get relationMappings() {
    return {
      erc20_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: Erc20Contract,
        join: {
          from: 'erc20_statistic.erc20_contract_id',
          to: 'erc20_contract.id',
        },
      },
    };
  }
}
