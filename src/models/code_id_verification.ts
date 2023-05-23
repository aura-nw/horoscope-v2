/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { Code } from './code';

export class CodeIdVerification extends BaseModel {
  code_id!: number;

  data_hash!: string;

  instantiate_msg_schema: string | undefined;

  query_msg_schema: string | undefined;

  execute_msg_schema: string | undefined;

  s3_location: string | undefined;

  verification_status: string | undefined;

  compiler_version: string | undefined;

  github_url: string | undefined;

  verify_step!: any;

  verified_at: Date | undefined;

  static get tableName() {
    return 'code_id_verification';
  }

  static get VERIFICATION_STATUS() {
    return {
      FAIL: 'FAIL',
      VERIFYING: 'VERIFYING',
      SUCCESS: 'SUCCESS',
    };
  }

  static get jsonAttributes() {
    return ['verify_step'];
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['code_id', 'data_hash', 'verify_step'],
      properties: {
        code_id: { type: 'number' },
        data_hash: { type: 'string' },
        instantiate_msg_schema: { type: ['string', 'null'] },
        query_msg_schema: { type: ['string', 'null'] },
        execute_msg_schema: { type: ['string', 'null'] },
        s3_location: { type: ['string', 'null'] },
        verification_status: {
          type: ['string', 'null'],
          enum: Object.values(this.VERIFICATION_STATUS),
        },
        compiler_version: { type: ['string', 'null'] },
        github_url: { type: ['string', 'null'] },
        verify_step: {
          type: 'object',
          properties: {
            step: { type: 'number' },
            result: { type: ['string', 'null'] },
            msg_code: { type: ['string', 'null'] },
          },
        },
        verified_at: { type: ['string', 'null'], format: 'date-time' },
      },
    };
  }

  static get relationMappings() {
    return {
      code: {
        relation: Model.BelongsToOneRelation,
        modelClass: Code,
        join: {
          from: 'code_id_verification.code_id',
          to: 'code.code_id',
        },
      },
    };
  }
}
