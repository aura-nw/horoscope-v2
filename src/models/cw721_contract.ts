import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import CW721Token from './cw721_token';
// eslint-disable-next-line import/no-cycle
import CW721Tx from './cw721_tx';
// eslint-disable-next-line import/no-cycle
import CodeId from './code_id';

export default class CW721Contract extends BaseModel {
  code_id!: string;

  address!: string;

  name?: string;

  symbol?: string;

  minter?: string;

  creator?: string;

  id?: number;

  created_at?: Date;

  updated_at?: Date;

  static get tableName() {
    return 'cw721_contract';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['code_id', 'address'],
      properties: {
        code_id: { type: 'string' },
        address: { type: 'string' },
        minter: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      tokens: {
        relation: Model.HasManyRelation,
        modelClass: CW721Token,
        join: {
          from: 'cw721_contract.address',
          to: 'cw721_token.contract_address',
        },
      },
      txs: {
        relation: Model.HasManyRelation,
        modelClass: CW721Tx,
        join: {
          from: 'cw721_contract.address',
          to: 'cw721_tx.contract_address',
        },
      },
      codeid: {
        relation: Model.BelongsToOneRelation,
        modelClass: CodeId,
        join: {
          from: 'cw721_contract.code_id',
          to: 'code_id.code_id',
        },
      },
    };
  }
}
