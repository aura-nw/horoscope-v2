import { Model } from 'objection';
import BaseModel from './base';
import { TransactionMessage } from './transaction_message';
import { Transaction } from './transaction';
// eslint-disable-next-line import/no-cycle
import { EvmEvent } from './evm_event';
// eslint-disable-next-line import/no-cycle
import { EvmInternalTransaction } from './evm_internal_transaction';

export class EVMTransaction extends BaseModel {
  [relation: string]: any;

  id!: number;

  hash!: Buffer;

  height!: number;

  from!: Buffer;

  to!: Buffer;

  size!: string;

  value!: string;

  gas!: bigint;

  gas_fee_cap!: bigint;

  gas_tip_cap!: bigint;

  data!: Buffer;

  nonce!: bigint;

  tx_msg_id!: number;

  tx_id!: number;

  contract_address!: Buffer;

  index!: number;

  status!: number;

  reason!: string;

  gas_used!: bigint;

  gas_price!: bigint;

  gas_limit!: bigint;

  type!: number;

  timestamp!: Date;

  additional_data!: any;

  static get tableName() {
    return 'evm_transaction';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['height'],
      properties: {
        height: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      transaction_message: {
        relation: Model.BelongsToOneRelation,
        modelClass: TransactionMessage,
        join: {
          from: 'evm_transaction.tx_msg_id',
          to: 'transaction_message.id',
        },
      },
      transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: Transaction,
        join: {
          from: 'evm_transaction.tx_id',
          to: 'transaction.id',
        },
      },
      evm_events: {
        relation: Model.HasManyRelation,
        modelClass: EvmEvent,
        join: {
          from: 'evm_transaction.id',
          to: 'evm_event.evm_tx_id',
        },
      },
      evm_internal_transactions: {
        relation: Model.HasManyRelation,
        modelClass: EvmInternalTransaction,
        join: {
          from: 'evm_transaction.id',
          to: 'evm_internal_transaction.evm_tx_id',
        },
      },
    };
  }
}
