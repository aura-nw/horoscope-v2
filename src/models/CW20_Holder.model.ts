import BaseModel from './BaseModel';

export interface ICW20Holder {
  holder_id: number;
  address: string;
  balance: string;
  token_id: number;
}
export class CW20Holder extends BaseModel implements ICW20Holder {
  token_id!: number;

  holder_id!: number;

  address!: string;

  balance!: string;

  static get tableName() {
    return 'CW20_Holder';
  }

  static get idColumn() {
    return 'holder_id';
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
