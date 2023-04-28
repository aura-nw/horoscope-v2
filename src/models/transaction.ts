/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { Event } from './event';
import { TransactionMessage } from './transaction_message';

export class Transaction extends BaseModel {
  [relation: string]: any;

  id!: number;

  height!: number;

  hash!: string;

  codespace!: string;

  code!: number;

  gas_used!: string;

  gas_wanted!: string;

  gas_limit!: string;

  fee!: string;

  memo!: string;

  // fee_payer!: string;

  // fee_granter!: string;

  // signer_public_key_type!: string;

  // signer_public_key_threshold: number | undefined;

  timstamp!: Date;

  data!: any;

  static get tableName() {
    return 'transaction';
  }

  static get jsonAttributes() {
    return ['data'];
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'height',
        'hash',
        'codespace',
        'code',
        'gas_used',
        'gas_wanted',
        'gas_limit',
        'fee',
        // 'fee_payer',
        // 'fee_granter',
        // 'signer_public_key_type',
        // 'signer_public_key_threshold',
        'timestamp',
        'data',
      ],
      properties: {
        height: { type: 'number' },
        hash: { type: 'string' },
        codespace: { type: 'string' },
        code: { type: 'number' },
        gas_used: { type: 'string' },
        gas_wanted: { type: 'string' },
        gas_limit: { type: 'string' },
        // fee: { type: 'number' },
        // fee_payer: { type: 'string' },
        // fee_granter: { type: 'string' },
        // signer_public_key_type: { type: 'string' },
        // signer_public_key_threshold: { type: 'number' },
        timestamp: { type: 'string', format: 'date-time' },
        memo: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      owner: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'block',
        join: {
          from: 'transaction.height',
          to: 'block.height',
        },
      },
      messages: {
        relation: Model.HasManyRelation,
        modelClass: TransactionMessage,
        join: {
          from: 'transaction.id',
          to: 'transaction_message.tx_id',
        },
      },
      events: {
        relation: Model.HasManyRelation,
        modelClass: Event,
        join: {
          from: 'transaction.id',
          to: 'event.tx_id',
        },
      },
    };
  }
}
