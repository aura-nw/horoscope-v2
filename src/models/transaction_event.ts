import { Model } from 'objection';
import BaseModel from './base';

export default class TransactionEvent extends BaseModel {
  tx_id!: number;

  tx_msg_index: number | undefined;

  type!: string;

  static get tableName() {
    return 'transaction_event';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['tx_id', 'type'],
      properties: {
        tx_id: { type: 'number' },
        tx_msg_index: { type: 'number' },
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
          from: 'transaction_event.tx_id',
          to: 'transaction.id',
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
