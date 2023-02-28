import BaseModel from './BaseModel';

export interface ICW20Holder {
  address: string;
  balance: bigint;
  contract_address: string;
}
export class CW20Holder extends BaseModel implements ICW20Holder {
  contract_address!: string;

  address!: string;

  balance!: bigint;

  static get tableName() {
    return 'cw20_holders';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      properties: {
        contract_address: { type: 'string' },
        address: { type: 'string' },
        balance: { type: 'number' },
      },
    };
  }
}
