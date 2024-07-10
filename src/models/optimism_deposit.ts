import BaseModel from './base';

export class OptimismDeposit extends BaseModel {
  l1_block!: number;

  l1_tx_hash!: string;

  l1_from!: string;

  l2_to!: string;

  l2_tx_hash!: string;

  gas_used!: bigint;

  gas_price!: bigint;

  timestamp!: Date;

  static get tableName() {
    return 'optimism_deposit';
  }
}
