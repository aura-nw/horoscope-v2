/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { Transaction } from './transaction';
import { EventAttribute } from './event_attribute';

export class Event extends BaseModel {
  tx_id!: number;

  tx_msg_index: number | undefined;

  type!: string;

  block_height!: number | undefined;

  source!: string;

  static get tableName() {
    return 'event';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['type'],
      properties: {
        tx_id: { type: 'number' },
        tx_msg_index: { type: 'number' },
        type: { type: 'string' },
        block_height: { type: 'number' },
        source: { type: 'string', enum: Object.values(this.SOURCE) },
      },
    };
  }

  static get relationMappings() {
    return {
      transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: Transaction,
        join: {
          from: 'event.tx_id',
          to: 'transaction.id',
        },
      },
      attributes: {
        relation: Model.HasManyRelation,
        modelClass: EventAttribute,
        join: {
          from: 'event.id',
          to: 'event_attribute.event_id',
        },
      },
    };
  }

  static get SOURCE() {
    return {
      BEGIN_BLOCK_EVENT: 'BEGIN_BLOCK_EVENT',
      END_BLOCK_EVENT: 'END_BLOCK_EVENT',
      TX_EVENT: 'TX_EVENT',
    };
  }

  static EVENT_TYPE = {
    STORE_CODE: 'store_code',
    SUBMIT_PROPOSAL: 'submit_proposal',
    INSTANTIATE: 'instantiate',
    MESSAGE: 'message',
    EXECUTE: 'execute',
    DELEGATE: 'delegate',
    REDELEGATE: 'redelegate',
    UNBOND: 'unbond',
    WASM: 'wasm',
  };
}
