import { ICW20AssetInfo } from 'src/common/types/interfaces';
import { ICW20MarketingInfo } from 'src/services/asset-indexer/common.service';
import BaseModel from './BaseModel';

export interface ICW20Token {
  code_id: string;
  asset_info: ICW20AssetInfo;
  contract_address: string;
  marketing_info: ICW20MarketingInfo;
}
export class CW20Token extends BaseModel implements ICW20Token {
  code_id!: string;

  asset_info!: ICW20AssetInfo;

  contract_address!: string;

  marketing_info!: ICW20MarketingInfo;

  static get tableName() {
    return 'CW20_Token';
  }

  static get idColumn() {
    return 'contract_address';
  }

  //   static get jsonSchema() {
  //     return {
  //       type: 'object',
  //       properties: {
  //         token_id: { type: 'number' },
  //         code_id: { type: 'string' },
  //         asset_info: { type: 'object' },
  //         contract_address: { type: 'string' },
  //         marketing_info: { type: 'object' },
  //       },
  //     };
  //   }
}
