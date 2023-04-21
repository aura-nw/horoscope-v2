import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import CW721Contract from './cw721_contract';

export default class CW721Token extends BaseModel {
  [relation: string]: any;

  onchain_token_id!: string;

  token_uri?: string;

  extension?: any;

  owner?: string;

  id?: number;

  cw721_contract_id!: number;

  last_updated_height!: number;

  created_at?: Date;

  burned?: boolean;

  static get tableName() {
    return 'cw721_token';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'onchain_token_id',
        'cw721_contract_id',
        'last_updated_height',
      ],
      properties: {
        onchain_token_id: { type: 'string' },
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
