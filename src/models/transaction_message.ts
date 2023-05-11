/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { Transaction } from './transaction';
import { Event } from './event';
import { TransactionMessageReceiver } from './transaction_message_receiver';

export class TransactionMessage extends BaseModel {
  [relation: string]: any;

  id!: number;

  tx_id!: number;

  index!: number;

  type!: string;

  sender!: string;

  content!: any;

  parent_id!: number;

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
        parent_id: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: Transaction,
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
      events: {
        relation: Model.HasManyRelation,
        modelClass: Event,
        join: {
          from: ['transaction_message.tx_id', 'transaction_message.index'],
          to: ['event.tx_id', 'event.tx_msg_index'],
        },
      },
    };
  }
}
