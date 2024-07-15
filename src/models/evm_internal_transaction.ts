import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { EVMTransaction } from './evm_transaction';

export class EvmInternalTransaction extends BaseModel {
  [relation: string]: any;

  id!: number;

  evm_tx_id!: string;

  type_trace_address!: string;

  type!: string;

  from!: string;

  to!: string;

  value!: number;

  input!: string;

  gas!: bigint;

  gas_used!: bigint;

  error!: string;

  static get tableName() {
    return 'evm_internal_transaction';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'evm_tx_id',
        'type_trace_address',
        'type',
        'value',
        'input',
        'gas',
        'gas_used',
      ],
      properties: {
        evm_tx_id: { type: 'string' },
        type_trace_address: { type: 'string' },
        type: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        value: { type: 'number' },
        input: { type: 'string' },
        gas: { type: 'number' },
        gas_used: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      evm_transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: EVMTransaction,
        join: {
          from: 'evm_internal_transaction.evm_tx_id',
          to: 'evm_transaction.id',
        },
      },
    };
  }

  static TYPE = {
    CREATE: 'CREATE',
    CALL: 'CALL',
    DELEGATECALL: 'DELEGATECALL',
    CREATE2: 'CREATE2',
    SELFDESTRUCT: 'SELFDESTRUCT',
  };
}
