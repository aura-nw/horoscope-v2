import BaseModel from './base';

export interface IConsensusPubkey {
  type: string;
  key: string;
}

export class Validator extends BaseModel {
  id!: number;

  operator_address!: string;

  account_address!: string;

  consensus_address!: string;

  consensus_pubkey!: IConsensusPubkey;

  jailed!: boolean;

  status!: string;

  tokens!: string;

  delegator_shares!: string;

  description!: JSON;

  unbonding_height!: number;

  unbonding_time!: string;

  commission!: JSON;

  min_self_delegation!: string;

  uptime!: number;

  self_delegation_balance!: string;

  percent_voting_power!: number;

  start_height!: number;

  index_offset!: number;

  jailed_until!: string;

  tombstoned!: boolean;

  missed_blocks_counter!: number;

  static get tableName() {
    return 'validator';
  }

  static get jsonAttributes() {
    return ['consensus_pubkey', 'description', 'commission'];
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'operator_address',
        'account_address',
        'consensus_address',
        'consensus_pubkey',
        'jailed',
        'status',
        'tokens',
        'delegator_shares',
        'description',
        'unbonding_height',
        'unbonding_time',
        'commission',
        'min_self_delegation',
        'uptime',
        'self_delegation_balance',
        'percent_voting_power',
        'start_height',
        'index_offset',
        'jailed_until',
        'tombstoned',
        'missed_blocks_counter',
      ],
      properties: {
        operator_address: { type: 'string' },
        account_address: { type: 'string' },
        consensus_address: { type: 'string' },
        consensus_pubkey: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            key: { type: 'string' },
          },
        },
        jailed: { type: 'boolean' },
        status: { type: 'string' },
        tokens: { type: 'string' },
        delegator_shares: { type: 'string' },
        unbonding_height: { type: 'number' },
        unbonding_time: { type: 'string', format: 'date-time' },
        min_self_delegation: { type: 'string' },
        uptime: { type: 'number' },
        self_delegation_balance: { type: 'string' },
        percent_voting_power: { type: 'number' },
        start_height: { type: 'number' },
        index_offset: { type: 'number' },
        jailed_until: { type: 'string', format: 'date-time' },
        tombstoned: { type: 'boolean' },
        missed_blocks_counter: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {};
  }
}
