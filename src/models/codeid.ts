import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import CW721Contract from './cw721_contract';

export default class Codeid extends BaseModel {
  id?: number;

  codeid!: string;

  type!: string;

  contract_name!: number;

  contract_version!: string;

  status!: string;

  created_at?: Date;

  updated_at?: Date;

  static get tableName() {
    return 'codeid';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'codeid',
        'type',
        'contract_name',
        'contract_version',
        'status',
      ],
      properties: {
        codeid: { type: 'string' },
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
          from: 'codeid.codeid',
          to: 'cw721_contract.code_id',
        },
      },
    };
  }
}
