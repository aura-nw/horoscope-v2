/* eslint-disable import/no-cycle */
import Objection, { Model } from 'objection';
import BaseModel from './base';
import { IbcChannel } from './ibc_channel';

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
      ibc_channel: {
        relation: Model.BelongsToOneRelation,
        filter: (builder: Objection.AnyQueryBuilder) =>
          builder.where('denom', 'like', 'ibc/%'),
        modelClass: IbcChannel,
        join: {
          from: 'asset.origin_id',
          to: 'ibc_channel.channel_id',
        },
      },
    };
  }

  static TYPE = {
    CW20_TOKEN: 'CW20_TOKEN',
    NATIVE: 'NATIVE',
    IBC_TOKEN: 'IBC_TOKEN',
    FACTORY_TOKEN: 'FACTORY_TOKEN',
  };

  static PREFIX = {
    IBC: 'ibc/',
    FACTORY: 'factory/',
  };
}
