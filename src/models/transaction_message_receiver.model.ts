import { Model } from 'objection';
import BaseModel from './base.model';

export interface TransactionMessageReceiver {
  tx_msg_id: number;
  address: string;
  reason: string | undefined;
}

export class TransactionMessageReceiver
  extends BaseModel
  implements TransactionMessageReceiver
{
  tx_msg_id!: number;

  address!: string;

  reason: string | undefined;

  static get tableName() {
    return 'transaction_message_receiver';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['tx_msg_id', 'address'],
      properties: {
        tx_msg_id: { type: 'number' },
        address: { type: 'string' },
        reason: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      owner: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'transaction_message',
        join: {
          from: 'transaction_message_receiver.tx_msg_id',
          to: 'transaction_message.id',
        },
      },
    };
  }
}
