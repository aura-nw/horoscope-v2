/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { Code } from './code';

export class Contract extends BaseModel {
  id!: string;

  creation_code_hash!: Buffer;

  runtime_code_hash!: Buffer;

  static get tableName() {
    return 'contracts';
  }

  static get relationMappings() {
    return {
      code: {
        relation: Model.BelongsToOneRelation,
        modelClass: Code,
        join: {
          from: 'contracts.creation_code_hash',
          to: 'code.creation_code_hash',
        },
      },
    };
  }
}
