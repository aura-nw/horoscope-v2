/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { SmartContract } from './smart_contract';
import { Event } from './event';
import { SmartContractEventAttribute } from './smart_contract_event_attribute';
import { Transaction } from './transaction';
import { TransactionMessage } from './transaction_message';

export class SmartContractEvent extends BaseModel {
  [relation: string]: any;

  id!: number;

  smart_contract_id!: number;

  action?: string;

  event_id!: number;

  index!: number;

  static get tableName() {
    return 'smart_contract_event';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      properties: {
        smart_contract_id: { type: 'number' },
        event_id: { type: 'number' },
        index: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      smart_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: SmartContract,
        join: {
          from: 'smart_contract_event.smart_contract_id',
          to: 'smart_contract.id',
        },
      },
      event: {
        relation: Model.BelongsToOneRelation,
        modelClass: Event,
        join: {
          from: 'smart_contract_event.event_id',
          to: 'event.id',
        },
      },
      attributes: {
        relation: Model.HasManyRelation,
        modelClass: SmartContractEventAttribute,
        join: {
          from: 'smart_contract_event.id',
          to: 'smart_contract_event_attribute.smart_contract_event_id',
        },
      },
      tx: {
        relation: Model.HasOneThroughRelation,
        modelClass: Transaction,
        join: {
          from: 'smart_contract_event.event_id',
          to: 'transaction.id',
          through: {
            from: 'event.id',
            to: 'event.tx_id',
          },
        },
      },
      message: {
        relation: Model.HasOneThroughRelation,
        modelClass: TransactionMessage,
        join: {
          from: 'smart_contract_event.event_id',
          to: ['transaction_message.tx_id', 'transaction_message.index'],
          through: {
            from: 'event.id',
            to: ['event.tx_id', 'event.tx_msg_index'],
          },
        },
      },
    };
  }
}
