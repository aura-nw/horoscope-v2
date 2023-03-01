import BaseModel from './BaseModel';

export interface ICW20Tx {
  id?: number;
  tx_hash: string;
  contract_address: string;
  from: string;
  to: string;
  amount: number;
  action: string;
  created_at?: Date;
  updated_at?: Date;
}

export class CW20Tx extends BaseModel implements ICW20Tx {
  id?: number;

  action!: string;

  from!: string;

  to!: string;

  amount!: number;

  tx_hash!: string;

  contract_address!: string;

  created_at?: Date;

  updated_at?: Date;

  static get tableName() {
    return 'cw20_txs';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      properties: {
        tx_hash: { type: 'string' },
        contract_address: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        action: { type: 'string' },
        amount: { type: 'number' },
      },
    };
  }
}
