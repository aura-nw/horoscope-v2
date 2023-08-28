/* eslint-disable import/no-cycle */
import BaseModel from './base';

export class IbcClient extends BaseModel {
  id!: number;

  client_id!: string;

  counterparty_chain_id!: string;

  client_state!: any;

  consensus_state!: any;

  client_type!: string;

  static get tableName() {
    return 'ibc_client';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'client_id',
        'counterparty_chain_id',
        'client_state',
        'consensus_state',
        'client_type',
      ],
      properties: {
        client_id: { type: 'string' },
        counterparty_chain_id: { type: 'string' },
        client_state: { type: 'object' },
        consensus_state: { type: 'object' },
        client_type: { type: 'string' },
      },
    };
  }
}
