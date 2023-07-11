import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { Event } from './event';

export class EventAttribute extends BaseModel {
  event_id!: string;

  key!: string;

  value!: string;

  composite_key!: string;

  block_height!: number;

  tx_id!: number;

  index!: number;

  static get tableName() {
    return 'event_attribute';
  }

  static get idColumn(): string[] {
    return ['event_id', 'index', 'block_height'];
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['event_id', 'key', 'value'],
      properties: {
        event_id: { type: 'string' },
        key: { type: 'string' },
        value: { type: 'string' },
        composite_key: { type: 'string' },
        block_height: { type: 'number' },
        tx_id: { type: 'number' },
        index: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      event: {
        relation: Model.BelongsToOneRelation,
        modelClass: Event,
        join: {
          from: 'event_attribute.event_id',
          to: 'event.id',
        },
      },
    };
  }

  static ATTRIBUTE_KEY = {
    BALANCES: 'balances',
    DELEGATION_RESPONSES: 'delegation_responses',
    REDELEGATION_RESPONSES: 'redelegation_responses',
    UNBONDING_RESPONSES: 'unbonding_responses',
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
    EDIT_VALIDATOR: 'edit_validator',
    RECV_PACKET: 'recv_packet',
    PACKET_DATA: 'packet_data',
    _CONTRACT_ADDRESS: '_contract_address',
    CODE_ID: 'code_id',
    EXECUTE: 'execute',
    TOKEN_ID: 'token_id',
    PROPOSAL_ID: 'proposal_id',
    STAKING: 'staking',
    DELEGATE: 'delegate',
    REDELEGATE: 'redelegate',
    UNBOND: 'unbond',
    OWNER: 'owner',
    TO: 'to',
    GRANTER: 'granter',
    GRANTEE: 'grantee',
    CLIENT_ID: 'client_id',
    PACKET_SRC_CHANNEL: 'packet_src_channel',
    PACKET_CONNECTION: 'packet_connection',
    PACKET_SRC_PORT: 'packet_src_port',
    FROM: 'from',
  };
}
