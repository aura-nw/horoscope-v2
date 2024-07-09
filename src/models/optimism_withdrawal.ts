import BaseModel from './base';

export class OptimismWithdrawal extends BaseModel {
  msg_nonce!: string;

  sender!: string;

  l2_tx_hash!: string;

  l2_block!: number;

  timestamp!: Date;

  static get tableName() {
    return 'optimism_withdrawal';
  }
}
