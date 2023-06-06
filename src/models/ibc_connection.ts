import BaseModel from './base';

export class IbcConnection extends BaseModel {
  connection_id!: string;

  client_id!: string;

  version!: any;

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
        'version',
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
}
