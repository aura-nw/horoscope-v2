import BaseModel from './base';

export class OptimismWithdrawalEvent extends BaseModel {
  withdrawal_hash!: string;

  l1_event_type!: string;

  sender!: string;

  l1_tx_hash!: string;

  l1_timestamp!: Date;

  l1_block!: number;

  static get tableName() {
    return 'optimism_withdrawal_event';
  }
}
