import { Model } from 'objection';
import BaseModel from './base';
// eslint-disable-next-line import/no-cycle
import { EVMTransaction } from './evm_transaction';

export class EvmEvent extends BaseModel {
  id!: number;

  tx_id!: number;

  evm_tx_id!: number;

  address!: string;

  topic0!: string;

  topic1!: string;

  topic2!: string;

  topic3!: string;

  block_height!: number;

  tx_hash!: string;

  block_hash!: string;

  tx_index!: number;

  static get tableName() {
    return 'evm_event';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'evm_tx_id',
        'tx_id',
        'address',
        'block_height',
        'tx_hash',
        'block_hash',
        'tx_index',
      ],
      properties: {
        id: { type: 'number' },
        tx_id: { type: 'number' },
        evm_tx_id: { type: 'number' },
        address: { type: 'string' },
        block_height: { type: 'number' },
        tx_hash: { type: 'string' },
        block_hash: { type: 'string' },
        tx_index: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      evm_transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: EVMTransaction,
        join: {
          from: 'evm_event.evm_tx_id',
          to: 'evm_transaction.id',
        },
      },
    };
  }
}
