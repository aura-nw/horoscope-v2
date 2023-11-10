/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';

export class CoinTransfer extends BaseModel {
  block_height!: number;

  tx_id!: number;

  tx_msg_id!: number;

  from!: string | null;

  to!: string;

  amount!: number;

  denom!: string;

  timestamp!: Date;

  static get tableName() {
    return 'coin_transfer';
  }

  static get idColumn(): string | string[] {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'block_height',
        'tx_id',
        'tx_msg_id',
        'from',
        'to',
        'amount',
        'denom',
        'timestamp',
      ],
      properties: {
        id: { type: 'number' },
        tx_id: { type: 'number' },
        tx_msg_id: { type: 'number' },
        from: { type: 'string', default: null },
        to: { type: 'string' },
        amount: { type: 'number' },
        denom: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    };
  }

  static get relationMappings() {
    return {
      transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'transaction',
        join: {
          from: 'coin_transfer.tx_id',
          to: 'transaction.id',
        },
      },
      transaction_message: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'transaction_message',
        join: {
          from: 'coin_transfer.tx_msg_id',
          to: 'transaction_message.id',
        },
      },
    };
  }
}
