import { Model } from 'objection';
import BaseModel from './base';
import TransactionMessageReceiver from './transaction_message_receiver';

export default class TransactionMessage extends BaseModel {
  tx_id!: number;

  index!: number;

  type!: string;

  sender!: string;

  content!: JSON;

  static get tableName() {
    return 'transaction_message';
  }

  static get jsonAttributes() {
    return ['content'];
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['tx_id', 'index', 'type', 'sender', 'content'],
      properties: {
        tx_id: { type: 'number' },
        index: { type: 'number' },
        type: { type: 'string' },
        sender: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      owner: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'transaction',
        join: {
          from: 'transaction_message.tx_id',
          to: 'transaction.id',
        },
      },
      receivers: {
        relation: Model.HasManyRelation,
        modelClass: TransactionMessageReceiver,
        join: {
          from: 'transaction_message.id',
          to: 'transaction_message_receiver.tx_msg_id',
        },
      },
    };
  }
}
