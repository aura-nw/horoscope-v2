/* eslint-disable import/no-cycle */
import BaseModel from './base';

export class NftAsset extends BaseModel {
  id!: number;

  address!: string;

  total_activity!: number;

  type!: number;

  transfer_24h!: number;

  updated_at!: Date;

  static get tableName() {
    return 'nft_asset';
  }

  static TYPE = {
    ERC721: 'ERC721',
    CW721: 'CW721',
  };
}
