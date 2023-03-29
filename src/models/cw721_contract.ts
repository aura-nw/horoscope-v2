import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { CW721Token } from './cw721_token';
import { CW721Tx } from './cw721_tx';

export interface ICW721Contract {
  id?: number;
  code_id: string;
  address: string;
  name: string;
  symbol: string;
  minter: string;
  creator: string;
  created_at?: Date;
  updated_at?: Date;
}

export class CW721Contract extends BaseModel implements ICW721Contract {
  code_id!: string;

  address!: string;

  name!: string;

  symbol!: string;

  minter!: string;

  creator!: string;

  id?: number | undefined;

  created_at?: Date;

  updated_at?: Date;

  static get tableName() {
    return 'cw721_contract';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['code_id', 'address', 'minter'],
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
    };
  }
}
