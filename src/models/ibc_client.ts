import BaseModel from './base';

export class IbcClient extends BaseModel {
  client_id!: string;

  counterparty_chain_id!: string;

  client_state!: any;

  status!: string;

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
        'status',
      ],
      properties: {
        client_id: { type: 'string' },
        counterparty_chain_id: { type: 'string' },
        status: { type: 'string' },
      },
    };
  }
}
