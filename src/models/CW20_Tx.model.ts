import BaseModel from './BaseModel';

export interface ICW20Tx {
  tx_hash: string;
  cw20_id: number;
}
export class CW20Tx extends BaseModel implements ICW20Tx {
  tx_hash!: string;

  cw20_id!: number;

  static get tableName() {
    return 'CW20_Tx';
  }

  static get idColumn() {
    return 'tx_hash';
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
