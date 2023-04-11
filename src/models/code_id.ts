import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import CW721Contract from './cw721_contract';

export default class CodeId extends BaseModel {
  id?: number;

  code_id!: string;

  type!: string;

  contract_name!: number;

  contract_version!: string;

  status!: string;

  created_at?: Date;

  updated_at?: Date;

  static get tableName() {
    return 'code_id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'code_id',
        'type',
        'contract_name',
        'contract_version',
        'status',
      ],
      properties: {
        code_id: { type: 'string' },
        type: { type: 'string' },
        contract_name: { type: 'string' },
        contract_version: { type: 'string' },
        status: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      cw721_contracts: {
        relation: Model.HasManyRelation,
        modelClass: CW721Contract,
        join: {
          from: 'code_id.code_id',
          to: 'cw721_contract.code_id',
        },
      },
    };
  }
}
