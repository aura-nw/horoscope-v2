import BaseModel from './base';

export class IbcConnection extends BaseModel {
  connection_id!: string;

  client_id!: string;

  versions!: any;

  state!: string;

  counterparty!: any;

  delay_period!: string;

  height!: any;

  static get tableName() {
    return 'ibc_connection';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'connection_id',
        'client_id',
        'state',
        'counterparty',
        'delay_period',
        'height',
      ],
      properties: {
        connection_id: { type: 'string' },
        client_id: { type: 'string' },
        state: { type: 'string' },
        delay_period: { type: 'string' },
      },
    };
  }

  static get STATE() {
    return {
      STATE_UNINITIALIZED_UNSPECIFIED: 'STATE_UNINITIALIZED_UNSPECIFIED',
      STATE_INIT: 'STATE_INIT',
      STATE_TRYOPEN: 'STATE_TRYOPEN',
      STATE_OPEN: 'STATE_OPEN',
      UNRECOGNIZED: 'UNRECOGNIZED',
    };
  }
}
