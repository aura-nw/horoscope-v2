import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import CW721Contract from './cw721_contract';
import CW721Token from './cw721_token';
import { SmartContractEvent } from './smart_contract_event';
import { Event } from './event';

export default class CW721Activity extends BaseModel {
  static softDelete = false;

  smart_contract_event!: SmartContractEvent;

  id!: number;

  [relation: string]: any | any[];

  action?: string;

  sender?: string;

  tx_hash!: string;

  cw721_contract_id!: number;

  cw721_token_id?: number;

  created_at?: Date;

  updated_at?: Date;

  from?: string;

  to?: string;

  height?: number;

  smart_contract_event_id!: number;

  static get tableName() {
    return 'cw721_activity';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['tx_hash', 'cw721_contract_id', 'height'],
      properties: {
        tx_hash: { type: 'string' },
        cw721_contract_id: { type: 'number' },
        sender: { type: 'string' },
        action: { type: 'string' },
        cw721_token_id: { type: 'number' },
        height: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      relate_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: CW721Contract,
        join: {
          from: 'cw721_activity.cw721_contract_id',
          to: 'cw721_contract.id',
        },
      },
      relate_token: {
        relation: Model.BelongsToOneRelation,
        modelClass: CW721Token,
        join: {
          from: 'cw721_activity.cw721_token_id',
          to: 'cw721_token.id',
        },
      },
      smart_contract_event: {
        relation: Model.BelongsToOneRelation,
        modelClass: SmartContractEvent,
        join: {
          from: 'cw721_activity.smart_contract_event_id',
          to: 'smart_contract_event.id',
        },
      },
      event: {
        relation: Model.HasOneThroughRelation,
        modelClass: Event,
        join: {
          from: 'cw721_activity.smart_contract_event_id',
          to: 'event.id',
          through: {
            from: 'smart_contract_event.id',
            to: 'smart_contract_event.event_id',
          },
        },
      },
    };
  }
}
