import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { Cw20Contract } from './cw20_contract';
import { SmartContract } from './smart_contract';

export class Cw20Event extends BaseModel {
  static softDelete = false;

  [relation: string]: any;

  id!: number;

  smart_contract_event_id!: number;

  sender?: string;

  action?: string;

  cw20_contract_id!: number;

  amount?: string;

  from?: string;

  to?: string;

  height!: number;

  static get tableName() {
    return 'cw20_activity';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['smart_contract_event_id', 'cw20_contract_id', 'height'],
      properties: {
        smart_contract_event_id: { type: 'number' },
        cw20_contract_id: { type: 'number' },
        height: { type: 'number' },
        to: { type: 'string' },
        action: { type: 'string' },
        amount: { type: 'string' },
        from: { type: 'string' },
        sender: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      cw20_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: Cw20Contract,
        join: {
          from: 'cw20_activity.cw20_contract_id',
          to: 'cw20_contract.id',
        },
      },
      smart_contract: {
        relation: Model.HasOneThroughRelation,
        modelClass: SmartContract,
        join: {
          from: 'cw20_activity.cw20_contract_id',
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
