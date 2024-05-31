/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { Contract } from './contract';

export class Code extends BaseModel {
  code_hash!: Buffer;

  code!: Buffer;

  static get tableName() {
    return 'code';
  }

  static get relationMappings() {
    return {
      creation_code_hashes: {
        relation: Model.HasManyRelation,
        modelClass: Contract,
        join: {
          from: 'code.code_hash',
          to: 'contracts.creation_code_hash',
        },
      },
      runtime_code_hashes: {
        relation: Model.HasManyRelation,
        modelClass: Contract,
        join: {
          from: 'code.code_hash',
          to: 'contracts.runtime_code_hash',
        },
      },
    };
  }
}
