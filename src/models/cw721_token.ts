import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import CW721Contract from './cw721_contract';

export default class CW721Token extends BaseModel {
  static softDelete = false;

  [relation: string]: any;

  token_id!: string;

  media_info?: any;

  owner?: string;

  id!: number;

  cw721_contract_id!: number;

  last_updated_height!: number;

  created_at?: Date;

  burned?: boolean;

  contract!: CW721Contract;

  static get tableName() {
    return 'cw721_token';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['token_id', 'last_updated_height'],
      properties: {
        token_id: { type: 'string' },
        cw721_contract_id: { type: 'number' },
        owner: { type: 'string' },
        last_updated_height: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: CW721Contract,
        join: {
          from: 'cw721_token.cw721_contract_id',
          to: 'cw721_contract.id',
        },
      },
    };
  }
}
