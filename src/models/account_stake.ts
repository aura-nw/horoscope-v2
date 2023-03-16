import { Model } from 'objection';
import BaseModel from './base';

export default class AccountStake extends BaseModel {
  account_id!: number;

  validator_src_id!: number;

  validator_dst_id: number | undefined;

  type!: string;

  shares: number | undefined;

  balance!: string;

  creation_height: number | undefined;

  end_time: string | undefined;

  static get tableName() {
    return 'account_stake';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['account_id', 'validator_src_id', 'balance'],
      properties: {
        account_id: { type: 'number' },
        validator_src_id: { type: 'number' },
        validator_dst_id: { type: 'number' },
        shares: { type: 'number' },
        balance: { type: 'string' },
        creation_height: { type: 'number' },
        end_time: { type: 'string', format: 'date-time' },
      },
    };
  }

  static get relationMappings() {
    return {
      account: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'account',
        join: {
          from: 'account_stake.account_id',
          to: 'account.id',
        },
      },
      src_validator: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'validator',
        join: {
          from: 'account_stake.validator_src_id',
          to: 'validator.id',
        },
      },
      dst_validator: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'account',
        join: {
          from: 'account_stake.validator_dst_id',
          to: 'validator.id',
        },
      },
    };
  }
}
