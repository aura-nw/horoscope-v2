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

  balances: IBalance[] | undefined;

  spendable_balances: IBalance[] | undefined;

  type: string | undefined;

  pubkey: IPubkey | undefined;

  account_number: number | undefined;

  sequence: number | undefined;

  static get tableName() {
    return 'account';
  }

  static get jsonAttributes() {
    return ['balances', 'spendable_balances', 'pubkey'];
  }

  static get jsonSchema() {
    return {
      type: 'object',
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
                require: false,
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
    };
  }
}
