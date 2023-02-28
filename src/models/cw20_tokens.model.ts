import {
  ICW20AssetInfo,
  ICW20MarketingInfo,
} from 'src/services/asset-indexer/cw20-asset.service';
import BaseModel from './BaseModel';

export interface ICW20Token {
  id: number;
  code_id: string;
  asset_info: ICW20AssetInfo;
  contract_address: string;
  marketing_info: ICW20MarketingInfo;
}
export class CW20Token extends BaseModel implements ICW20Token {
  id!: number;

  code_id!: string;

  asset_info!: ICW20AssetInfo;

  contract_address!: string;

  marketing_info!: ICW20MarketingInfo;

  static get tableName() {
    return 'cw20_tokens';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      properties: {
        code_id: { type: 'string' },
        asset_info: { type: 'object' },
        contract_address: { type: 'string' },
        marketing_info: { type: 'object' },
      },
    };
  }
}
