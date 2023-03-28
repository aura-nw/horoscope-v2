/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import { ICoin } from 'src/common/types/interfaces';
import { Account } from './account';
import BaseModel from './base';

export default class AccountVesting extends BaseModel {
  account_id!: number;

  original_vesting!: ICoin[];

  delegated_free!: ICoin[];

  delegated_vesting!: ICoin[];

  start_time: number | undefined;

  end_time!: number;

  static get tableName() {
    return 'account_vesting';
  }

  static get jsonAttributes() {
    return ['original_vesting', 'delegated_free', 'delegated_vesting'];
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'account_id',
        'original_vesting',
        'delegated_free',
        'delegated_vesting',
        'end_time',
      ],
      properties: {
        account_id: { type: 'number' },
        original_vesting: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              denom: { type: 'string' },
              amount: { type: 'string' },
            },
          },
        },
        delegated_free: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              denom: { type: 'string' },
              amount: { type: 'string' },
            },
          },
        },
        delegated_vesting: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              denom: { type: 'string' },
              amount: { type: 'string' },
            },
          },
        },
        start_time: { type: ['number', 'null'] },
        end_time: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      account: {
        relation: Model.BelongsToOneRelation,
        modelClass: Account,
        join: {
          from: 'account_vesting.account_id',
          to: 'account.id',
        },
      },
    };
  }
}
