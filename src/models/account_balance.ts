/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { Account } from './account';

export class AccountBalance extends BaseModel {
  account!: Account;

  id!: number;

  denom!: string;

  amount!: string;

  base_denom!: string;

  created_at!: Date;

  last_updated_height!: number;

  account_id!: number;

  static get tableName() {
    return 'account_balance';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['denom', 'amount'],
      properties: {
        denom: { type: 'string' },
        amount: { type: 'string' },
        base_denom: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      account: {
        relation: Model.BelongsToOneRelation,
        modelClass: Account,
        join: {
          from: 'account_balance.account_id',
          to: 'account.id',
        },
      },
    };
  }
}
