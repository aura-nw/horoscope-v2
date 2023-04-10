import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { TransactionEvent } from './transaction_event';

export class TransactionEventAttribute extends BaseModel {
  event_id!: number;

  key!: string;

  value!: string;

  static get tableName() {
    return 'transaction_event_attribute';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['event_id', 'key', 'value'],
      properties: {
        event_id: { type: 'number' },
        key: { type: 'string' },
        value: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      event: {
        relation: Model.BelongsToOneRelation,
        modelClass: TransactionEvent,
        join: {
          from: 'transaction_event_attribute.event_id',
          to: 'transaction_event.id',
        },
      },
    };
  }

  static ATTRIBUTE_KEY = {
    BALANCES: 'balances',
    DELEGATION_RESPONSES: 'delegation_responses',
    REDELEGATION_RESPONSES: 'redelegation_responses',
    UNBONDING_RESPONSES: 'unbonding_responses',
    MESSAGE: 'message',
    ACTION: 'action',
    TRANSFER: 'transfer',
    SENDER: 'sender',
    RECEIVER: 'receiver',
    SPENDER: 'spender',
    RECIPIENT: 'recipient',
    COIN_RECEIVED: 'coin_received',
    COIN_SPENT: 'coin_spent',
    WITHDRAW_REWARDS: 'withdraw_rewards',
    AMOUNT: 'amount',
    VALIDATOR: 'validator',
    SOURCE_VALIDATOR: 'source_validator',
    DESTINATION_VALIDATOR: 'destination_validator',
    RECV_PACKET: 'recv_packet',
    PACKET_DATA: 'packet_data',
    INSTANTIATE: 'instantiate',
    _CONTRACT_ADDRESS: '_contract_address',
    CODE_ID: 'code_id',
    EXECUTE: 'execute',
    TOKEN_ID: 'token_id',
  };
}
