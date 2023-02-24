import BaseModel from './BaseModel';

export interface ICW20Holder {
  address: string;
  balance: string;
  cw20_token: string;
}
export class CW20Holder extends BaseModel implements ICW20Holder {
  cw20_token!: string;

  address!: string;

  balance!: string;

  static get tableName() {
    return 'CW20_Holder';
  }

  static get idColumn() {
    return ['address', 'cw20_token'];
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
