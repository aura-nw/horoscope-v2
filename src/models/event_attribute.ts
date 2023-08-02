import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { Event } from './event';
import { Transaction } from './transaction';

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
      transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: Transaction,
        join: {
          from: 'event_attribute.tx_id',
          to: 'transaction.id',
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
    SENDER: 'sender',
    RECEIVER: 'receiver',
    SPENDER: 'spender',
    RECIPIENT: 'recipient',
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
    FROM: 'from',
    FEE: 'fee',
    FEE_PAYER: 'fee_payer',
    CLIENT_ID: 'client_id',
    CLIENT_TYPE: 'client_type',
    CONNECTION_ID: 'connection_id',
    COUNTERPARTY_CLIENT_ID: 'counterparty_client_id',
    COUNTERPARTY_CONNECTION_ID: 'counterparty_connection_id',
    CHANNEL_ID: 'channel_id',
    PORT_ID: 'port_id',
    COUNTERPARTY_PORT_ID: 'counterparty_port_id',
    COUNTERPARTY_CHANNEL_ID: 'counterparty_channel_id',
  };

  static ATTRIBUTE_COMPOSITE_KEY = {
    COIN_SPENT_SPENDER: 'coin_spent.spender',
    COIN_RECEIVED_RECEIVER: 'coin_received.receiver',
    COIN_SPENT_AMOUNT: 'coin_spent.amount',
    COIN_RECEIVED_AMOUNT: 'coin_received.amount',
    USE_FEEGRANT_GRANTER: 'use_feegrant.granter',
    USE_FEEGRANT_GRANTEE: 'use_feegrant.grantee',
    TX_FEE: 'tx.fee',
    TX_FEE_PAYER: 'tx.fee_payer',
  };
}
