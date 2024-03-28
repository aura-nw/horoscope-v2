import BaseModel from './base';

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
        'from',
        'to',
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
}
