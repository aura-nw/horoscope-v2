import { Model } from 'objection';
import BaseModel from './base';

export default class Transaction extends BaseModel {
  height!: number;

  hash!: string;

  codespace!: string;

  code!: number;

  gas_used!: string;

  gas_wanted!: string;

  gas_limit!: string;

  fee!: string;

  fee_payer!: string;

  fee_granter!: string;

  signer_public_key_type!: string;

  signer_public_key_threshold: number | undefined;

  timstamp!: Date;

  data!: JSON;

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
        'fee_payer',
        'fee_granter',
        'signer_public_key_type',
        'signer_public_key_threshold',
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
        fee: { type: 'string' },
        fee_payer: { type: 'string' },
        fee_granter: { type: 'string' },
        signer_public_key_type: { type: 'string' },
        signer_public_key_threshold: { type: 'number' },
        timestamp: { type: 'timestamp' },
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
        modelClass: 'transaction_message',
        join: {
          from: 'transaction.id',
          to: 'transaction_message.tx_id',
        },
      },
      events: {
        relation: Model.HasManyRelation,
        modelClass: 'transaction_event',
        join: {
          from: 'transaction.id',
          to: 'transaction_event.tx_id',
        },
      },
    };
  }
}
