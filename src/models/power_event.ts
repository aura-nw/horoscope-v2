/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { Block } from './block';
import { Transaction } from './transaction';
import { Validator } from './validator';

export class PowerEvent extends BaseModel {
  tx_id!: number;

  height!: number;

  type!: string;

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
      CREATE_VALIDATOR: 'create_validator',
    };
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['tx_id', 'height', 'type', 'amount', 'time'],
      properties: {
        tx_id: { type: 'number' },
        height: { type: 'number' },
        type: { type: 'string', enum: Object.values(this.TYPES) },
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
