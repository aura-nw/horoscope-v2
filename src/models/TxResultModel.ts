import { DecodedTxRaw, decodeTxRaw } from '@cosmjs/proto-signing';
import { TxResult } from 'cosmjs-types/tendermint/abci/types';
import BaseModel from './BaseModel';

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
