import { Model } from 'objection';
import BaseModel from './base';

export default class TransactionPowerEvent extends BaseModel {
  tx_id!: number;

  type!: string;

  delegator_id!: number;

  validator_src_id!: number;

  validator_dst_id: number | undefined;

  amount!: string;

  time!: string;

  static get tableName() {
    return 'transaction_power_event';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'tx_id',
        'type',
        'delegator_id',
        'validator_src_id',
        'amount',
        'time',
      ],
      properties: {
        tx_id: { type: 'number' },
        type: { type: 'string' },
        delegator_id: { type: 'number' },
        validator_src_id: { type: 'number' },
        validator_dst_id: { type: 'number' },
        amount: { type: 'string' },
        time: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'transaction',
        join: {
          from: 'transaction_power_event.tx_id',
          to: 'transaction.id',
        },
      },
      delegator: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'account',
        join: {
          from: 'transaction_power_event.delegator_id',
          to: 'account.id',
        },
      },
      src_validator: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'validator',
        join: {
          from: 'transaction_power_event.validator_src_id',
          to: 'validator.id',
        },
      },
      dst_validator: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'validator',
        join: {
          from: 'transaction_power_event.validator_dst_id',
          to: 'validator.id',
        },
      },
    };
  }
}
