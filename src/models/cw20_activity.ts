import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { Cw20Contract } from './cw20_contract';

export class Cw20Event extends BaseModel {
  id!: number;

  tx_hash!: string;

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
      required: ['tx_hash', 'cw20_contract_id', 'height'],
      properties: {
        tx_hash: { type: 'string' },
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
          from: 'cw20_event.cw20_contract_id',
          to: 'cw20_contract.id',
        },
      },
    };
  }
}
