/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { IbcConnection } from './ibc_connection';

export class IbcChannel extends BaseModel {
  id!: number;

  ibc_connection_id!: number;

  channel_id!: string;

  port_id!: string;

  counterparty_port_id!: string;

  counterparty_channel_id!: string;

  state!: boolean;

  static get tableName() {
    return 'ibc_channel';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'ibc_connection_id',
        'channel_id',
        'port_id',
        'counterparty_port_id',
        'counterparty_channel_id',
        'state',
      ],
      properties: {
        ibc_connection_id: { type: 'number' },
        channel_id: { type: 'string' },
        port_id: { type: 'string' },
        counterparty_port_id: { type: 'string' },
        counterparty_channel_id: { type: 'string' },
        state: { type: 'boolean' },
      },
    };
  }

  static get relationMappings() {
    return {
      ibc_connection: {
        relation: Model.BelongsToOneRelation,
        modelClass: IbcConnection,
        join: {
          from: 'ibc_channel.ibc_connection_id',
          to: 'ibc_connection.id',
        },
      },
    };
  }
}
