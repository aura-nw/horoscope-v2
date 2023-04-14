/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import { Account } from './account';
import BaseModel from './base';
import { Block } from './block';
import { Transaction } from './transaction';
import { Validator } from './validator';

export class PowerEvent extends BaseModel {
  tx_id!: number;

  height!: number;

  type!: string;

  delegator_id!: number;

  validator_src_id: number | undefined;

  validator_dst_id: number | undefined;

  amount!: string;

  time!: string;

  static get tableName() {
    return 'power_event';
  }

  static get TYPES() {
    return {
      DELEGATE: 'delegate',
      REDELEGATE: 'redelegate',
      UNBOND: 'unbond',
    };
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['tx_id', 'height', 'type', 'delegator_id', 'amount', 'time'],
      properties: {
        tx_id: { type: 'number' },
        height: { type: 'number' },
        type: { type: 'string', enum: Object.values(this.TYPES) },
        delegator_id: { type: 'number' },
        validator_src_id: { type: ['number', 'null'] },
        validator_dst_id: { type: ['number', 'null'] },
        amount: { type: 'string' },
        time: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      block: {
        relation: Model.BelongsToOneRelation,
        modelClass: Block,
        join: {
          from: 'power_event.height',
          to: 'block.height',
        },
      },
      transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: Transaction,
        join: {
          from: 'power_event.tx_id',
          to: 'transaction.id',
        },
      },
      delegator: {
        relation: Model.BelongsToOneRelation,
        modelClass: Account,
        join: {
          from: 'power_event.delegator_id',
          to: 'account.id',
        },
      },
      src_validator: {
        relation: Model.BelongsToOneRelation,
        modelClass: Validator,
        join: {
          from: 'power_event.validator_src_id',
          to: 'validator.id',
        },
      },
      dst_validator: {
        relation: Model.BelongsToOneRelation,
        modelClass: Validator,
        join: {
          from: 'power_event.validator_dst_id',
          to: 'validator.id',
        },
      },
    };
  }
}
