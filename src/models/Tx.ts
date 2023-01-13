import { decodeTxRaw } from '@cosmjs/proto-signing';
import BaseModel from './BaseModel';

export default class Tx extends BaseModel {
  static get tableName() {
    return 'tx_results';
  }

  tx_result!: Uint8Array;

  getTxResult() {
    return decodeTxRaw(this.tx_result);
  }
}
