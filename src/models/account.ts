/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import { ICoin } from '../common';
import { AccountStake } from './account_stake';
import { AccountVesting } from './account_vesting';
import BaseModel from './base';
import { PowerEvent } from './power_event';

export interface IPubkey {
  type: string;
  key: string;
}

export interface IBalance extends ICoin {
  base_denom?: string;
}

export class Account extends BaseModel {
  id!: number;

  address!: string;

  balances!: IBalance[];

  spendable_balances!: IBalance[];

  type!: string;

  pubkey!: IPubkey;

  account_number!: number;

  sequence!: number;

  static get tableName() {
    return 'account';
  }

  static get jsonAttributes() {
    return ['balances', 'spendable_balances', 'pubkey'];
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'address',
        'balances',
        'spendable_balances',
        'type',
        'account_number',
        'sequence',
      ],
      properties: {
        address: { type: 'string' },
        balances: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              denom: { type: 'string' },
              amount: { type: 'string' },
              base_denom: { type: 'string' },
            },
          },
        },
        spendable_balances: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              denom: { type: 'string' },
              amount: { type: 'string' },
              base_denom: { type: 'string' },
            },
          },
        },
        type: { type: 'string' },
        account_number: { type: 'number' },
        sequence: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      stakes: {
        relation: Model.HasManyRelation,
        modelClass: AccountStake,
        join: {
          from: 'account.id',
          to: 'account_stake.account_id',
        },
      },
      power_events: {
        relation: Model.HasManyRelation,
        modelClass: PowerEvent,
        join: {
          from: 'account.id',
          to: 'power_event.delegator_id',
        },
      },
      vesting: {
        relation: Model.BelongsToOneRelation,
        modelClass: AccountVesting,
        join: {
          from: 'account.id',
          to: 'account_vesting.account_id',
        },
      },
    };
  }
}
