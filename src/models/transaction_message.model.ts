import { Model } from 'objection';
import BaseModel from './BaseModel';

export interface TransactionMessage {
  tx_id: number;
  msg_index: number;
  type: string;
  sender: string;
  receiver: string[];
  content: JSON;
}

export class TransactionMessage extends BaseModel implements TransactionMessage {
  tx_id!: number;

  msg_index!: number;

  type!: string;

  sender!: string;

  receiver!: string[];

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
      properties: {
        tx_id: { type: 'number' },
        msg_index: { type: 'number' },
        type: { type: 'string' },
        sender: { type: 'string' },
        receiver: { type: 'array', items: { type: 'string' } },
        content: {
          type: 'object',
          patternProperties: {
            '^.*$': {
              anyOf: [{ type: 'string' }, { type: 'number' }],
            },
          },
        },
      },
    };
  }

  static get relationMappings() {
    return {
      owner: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'transaction',
        join: {
          from: 'transaction_message.tx_hash',
          to: 'transaction.hash',
        },
      },
    };
  }
}
