import { Model } from 'objection';
import { ICoin } from 'src/common/types/interfaces';
import BaseModel from './base';

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
        'pubkey',
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
        pubkey: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            key: { type: 'string' },
          },
        },
        account_number: { type: 'number' },
        sequence: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      stake: {
        relation: Model.HasManyRelation,
        modelClass: 'account_stake',
        join: {
          from: 'account.id',
          to: 'account_stake.account_id',
        },
      },
      stake_event: {
        relation: Model.HasManyRelation,
        modelClass: 'transaction_power_event',
        join: {
          from: 'account.id',
          to: 'transaction_power_event.delegator_id',
        },
      },
      vesting: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'account_vesting',
        join: {
          from: 'account.id',
          to: 'account_vesting.account_id',
        },
      },
    };
  }
}
