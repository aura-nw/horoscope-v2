/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { Cw20Contract } from './cw20_contract';

export class Asset extends BaseModel {
  id!: number;

  denom!: string;

  decimal!: string;

  name!: string;

  type!: string;

  price!: string;

  total_supply!: string;

  origin_id!: string;

  updated_at!: Date;

  static get tableName() {
    return 'asset';
  }

  static get relationMappings() {
    return {
      cw20_contract: {
        relation: Model.BelongsToOneRelation,
        modelClass: Cw20Contract,
        join: {
          from: 'asset.cw20_contract_id',
          to: 'cw20_contract.id',
        },
      },
    };
  }

  static TYPE = {
    CW20_TOKEN: 'CW20 Token',
    NATIVE: 'Native',
    IBC_TOKEN: 'Ibc Token',
  };
}
