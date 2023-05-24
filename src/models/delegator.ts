/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { Validator } from './validator';

export class Delegator extends BaseModel {
  validator_id!: number;

  delegator_address!: string;

  amount!: string;

  static get tableName() {
    return 'delegator';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['validator_id', 'delegator_address', 'amount'],
      properties: {
        validator_id: { type: 'number' },
        delegator_address: { type: 'string' },
        amount: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      validator: {
        relation: Model.BelongsToOneRelation,
        modelClass: Validator,
        join: {
          from: 'delegator.validator_id',
          to: 'validator.id',
        },
      },
    };
  }
}
