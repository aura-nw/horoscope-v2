/* eslint-disable import/no-cycle */
import { fromBase64, fromBech32, toBech32, toHex } from '@cosmjs/encoding';
import { pubkeyToRawAddress } from '@cosmjs/tendermint-rpc';
import { Model } from 'objection';
import config from '../../config.json' assert { type: 'json' };
import BaseModel from './base';
import { PowerEvent } from './power_event';

export interface IConsensusPubkey {
  type: string;
  key: string;
}

export class Validator extends BaseModel {
  id!: number;

  operator_address!: string;

  account_address!: string;

  consensus_address!: string;

  consensus_hex_address!: string;

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
        'consensus_hex_address',
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
        consensus_hex_address: { type: 'string' },
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
    return {
      src_power_event: {
        relation: Model.HasManyRelation,
        modelClass: PowerEvent,
        join: {
          from: 'validator.id',
          to: 'power_event.validator_src_id',
        },
      },
      dst_power_event: {
        relation: Model.HasManyRelation,
        modelClass: PowerEvent,
        join: {
          from: 'validator.id',
          to: 'power_event.validator_dst_id',
        },
      },
    };
  }

  static createNewValidator(validator: any): Validator {
    const consensusAddress: string = toBech32(
      `${config.networkPrefixAddress}${config.consensusPrefixAddress}`,
      pubkeyToRawAddress(
        'ed25519',
        fromBase64(validator.consensus_pubkey.key.toString())
      )
    );
    const consensusHexAddress: string = toHex(
      pubkeyToRawAddress(
        'ed25519',
        fromBase64(validator.consensus_pubkey.key.toString())
      )
    ).toUpperCase();
    const accountAddress = toBech32(
      config.networkPrefixAddress,
      fromBech32(validator.operator_address).data
    );
    const consensusPubkey = {
      type: validator.consensus_pubkey['@type'],
      key: validator.consensus_pubkey.key,
    };

    const validatorEntity = Validator.fromJson({
      operator_address: validator.operator_address,
      account_address: accountAddress,
      consensus_address: consensusAddress,
      consensus_hex_address: consensusHexAddress,
      consensus_pubkey: consensusPubkey,
      jailed: validator.jailed,
      status: validator.status,
      tokens: Number.parseInt(validator.tokens, 10),
      delegator_shares: Number.parseInt(validator.delegator_shares, 10),
      description: validator.description,
      unbonding_height: Number.parseInt(validator.unbonding_height, 10),
      unbonding_time: validator.unbonding_time,
      commission: validator.commission,
      min_self_delegation: Number.parseInt(validator.min_self_delegation, 10),
      uptime: 0,
      self_delegation_balance: 0,
      percent_voting_power: 0,
      start_height: 0,
      index_offset: 0,
      // TODO:
      // Ajv Format require { type: 'string', format: 'date-time' }
      // But when query Validator from DB, the data returned is of type Date,
      // so it needs to be converted to string to be able to insert into DB
      jailed_until: new Date(0).toISOString(),
      tombstoned: false,
      missed_blocks_counter: 0,
    });

    return validatorEntity;
  }
}
