import { DecodedTxRaw, decodeTxRaw } from '@cosmjs/proto-signing';
import BaseModel from './BaseModel';
import { TxResult } from '../../proto/codegen/types';

export default class TxResultModel extends BaseModel {
  static get tableName() {
    return 'tx_results';
  }

  tx_result!: Uint8Array;

  getTxResult(): TxResult {
    return TxResult.decode(this.tx_result);
  }

  getTxContent(): DecodedTxRaw {
    return decodeTxRaw(this.getTxResult().tx);
  }
}
