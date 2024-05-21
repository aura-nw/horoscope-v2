/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { Code } from './code';

export class CompiledContract extends BaseModel {
  id!: string;

  created_at!: Date;

  updated_at!: Date;

  created_by!: string;

  updated_by!: string;

  compiler!: string;

  version!: string;

  language!: string;

  name!: string;

  fully_qualified_name!: string;

  sources!: any;

  compiler_settings!: any;

  compilation_artifacts!: any;

  creation_code_hash!: Buffer;

  creation_code_artifacts!: any;

  runtime_code_hash!: Buffer;

  runtime_code_artifacts!: any;

  static get tableName() {
    return 'compiled_contracts';
  }

  static get relationMappings() {
    return {
      creation_code: {
        relation: Model.BelongsToOneRelation,
        modelClass: Code,
        join: {
          from: 'compiled_contracts.creation_code_hash',
          to: 'code.code_hash',
        },
      },
      runtime_code: {
        relation: Model.BelongsToOneRelation,
        modelClass: Code,
        join: {
          from: 'compiled_contracts.runtime_code_hash',
          to: 'code.code_hash',
        },
      },
    };
  }
}
