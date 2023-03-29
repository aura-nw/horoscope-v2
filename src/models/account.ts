/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import { ICoin } from 'src/common/types/interfaces';
import AccountStake from './account_stake';
import AccountVesting from './account_vesting';
import BaseModel from './base';
import TransactionPowerEvent from './transaction_power_event';

export interface IPubkey {
  type: string;
  key: string;
}

export interface IBalance extends ICoin {
  minimal_denom?: string;
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
              minimal_denom: {
                type: 'string',
                // optional: true,
              },
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
              minimal_denom: {
                type: 'string',
                // optional: true,
              },
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
      stake: {
        relation: Model.HasManyRelation,
        modelClass: AccountStake,
        join: {
          from: 'account.id',
          to: 'account_stake.account_id',
        },
      },
      stake_event: {
        relation: Model.HasManyRelation,
        modelClass: TransactionPowerEvent,
        join: {
          from: 'account.id',
          to: 'transaction_power_event.delegator_id',
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
