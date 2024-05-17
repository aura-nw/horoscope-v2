import BaseModel from './base';

export class EVMBlock extends BaseModel {
  height!: number;

  tx_count!: number;

  base_fee_per_gas!: bigint;

  date!: Date;

  difficulty!: bigint;

  extra_data!: string;

  gas_limit!: bigint;

  gas_used!: bigint;

  hash!: string;

  miner!: string;

  nonce!: string;

  parent_hash!: string;

  receipts_root!: string;

  state_root!: string;

  static get tableName() {
    return 'evm_block';
  }

  static get idColumn() {
    return 'height';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'height',
        'hash',
        'tx_count',
        'parent_hash',
        'receipts_root',
        'state_root',
      ],
      properties: {
        required: { type: 'number' },
        tx_count: { type: 'number' },
        hash: { type: 'string' },
        parent_hash: { type: 'string' },
        receipts_root: { type: 'string' },
        state_root: { type: 'string' },
      },
    };
  }
}
