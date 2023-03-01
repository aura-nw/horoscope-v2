import { Model } from 'objection';
import BaseModel from './BaseModel';

export interface TransactionEvent {
  tx_id: number;
  msg_index: number;
  type: string;
}

export class TransactionEvent extends BaseModel implements TransactionEvent {
  tx_id!: number;

  msg_index!: number;

  type!: string;

  static get tableName() {
    return 'transaction_event';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['tx_id', 'msg_index', 'type'],
      properties: {
        tx_id: { type: 'number' },
        msg_index: { type: 'number' },
        type: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      owner: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'transaction',
        join: {
          from: 'transaction_event.tx_hash',
          to: 'transaction.hash',
        },
      },
      attributes: {
        relation: Model.HasManyRelation,
        modelClass: 'transaction_event_attribute',
        join: {
          from: 'transaction_event.id',
          to: 'transaction_event_attribute.event_id',
        },
      },
    };
  }
}
