/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { IbcClient } from './ibc_client';

export class IbcConnection extends BaseModel {
  id!: number;

  ibc_client_id!: number;

  connection_id!: string;

  counterparty_client_id!: string;

  counterparty_connection_id!: string;

  static get tableName() {
    return 'ibc_connection';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'ibc_client_id',
        'connection_id',
        'counterparty_client_id',
        'counterparty_connection_id',
      ],
      properties: {
        ibc_client_id: { type: 'number' },
        connection_id: { type: 'string' },
        counterparty_client_id: { type: 'string' },
        counterparty_connection_id: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      ibc_client: {
        relation: Model.BelongsToOneRelation,
        modelClass: IbcClient,
        join: {
          from: 'ibc_connection.ibc_client_id',
          to: 'ibc_client.id',
        },
      },
    };
  }
}
