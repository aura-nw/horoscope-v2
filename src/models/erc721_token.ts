import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { Erc721Contract } from './erc721_contract';

export class Erc721Token extends BaseModel {
  static softDelete = false;

  [relation: string]: any;

  token_id!: string;

  owner!: string;

  id!: number;

  erc721_contract_address!: string;

  last_updated_height!: number;

  created_at!: Date;

  erc721_contract!: Erc721Contract;

  static get tableName() {
    return 'erc721_token';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['token_id', 'last_updated_height'],
      properties: {
        token_id: { type: 'string' },
        erc721_contract_id: { type: 'number' },
        owner: { type: 'string' },
        last_updated_height: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      erc721_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: Erc721Contract,
        join: {
          from: 'erc721_token.erc721_contract_address',
          to: 'erc721_contract.address',
        },
      },
    };
  }
}
