import BaseModel from './base';

export class IbcChannel extends BaseModel {
  state!: string;

  ordering!: string;

  counterparty!: any;

  connection_hops!: any;

  version!: string;

  port_id!: string;

  channel_id!: string;

  height!: any;

  connection_id!: string;

  static get tableName() {
    return 'ibc_channel';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'state',
        'ordering',
        'counterparty',
        'connection_hops',
        'version',
        'port_id',
        'channel_id',
      ],
      properties: {
        state: { type: 'string' },
        ordering: { type: 'string' },
        version: { type: 'string' },
        port_id: { type: 'string' },
        channel_id: { type: 'string' },
      },
    };
  }
}
