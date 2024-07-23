/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { EvmEvent } from './evm_event';

export class OptimismWithdrawal extends BaseModel {
  [relation: string]: any;

  msg_nonce!: string;

  sender!: string;

  l2_tx_hash!: string;

  l2_block!: number;

  timestamp!: Date;

  withdrawal_hash!: string;

  status!: string;

  evm_event_id!: number;

  l1_tx_hash!: string;

  evm_tx_id!: number;

  finalize_time!: Date;

  static get tableName() {
    return 'optimism_withdrawal';
  }

  static get relationMappings() {
    return {
      evm_event: {
        relation: Model.BelongsToOneRelation,
        modelClass: EvmEvent,
        join: {
          from: 'optimism_withdrawal.evm_event_id',
          to: 'evm_event.id',
        },
      },
    };
  }

  static get STATUS() {
    return {
      WAITING_TO_PROVE: 'waiting-to-prove',
      READY_TO_PROVE: 'ready-to-prove',
      WAITING_TO_FINALIZE: 'waiting-to-finalize',
      READY_TO_FINALIZE: 'ready-to-finalize',
      FINALIZE: 'finalized',
    };
  }

  static rebuildTxFromEvmEvent(evmEvent: EvmEvent) {
    return {
      transactionHash: evmEvent.tx_hash,
      blockNumber: evmEvent.block_height,
      logs: [
        {
          address: evmEvent.address,
          topics: [
            evmEvent.topic0,
            evmEvent.topic1,
            evmEvent.topic2,
            evmEvent.topic3,
          ],
          data: evmEvent.data,
        },
      ],
    };
  }
}
