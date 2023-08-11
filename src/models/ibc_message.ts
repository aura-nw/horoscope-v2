/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { IbcChannel } from './ibc_channel';
import { TransactionMessage } from './transaction_message';

export class IbcMessage extends BaseModel {
  [relation: string]: any | any[];

  id!: number;

  transaction_message_id!: number;

  src_channel_id!: string;

  src_port_id!: string;

  dst_channel_id!: string;

  dst_port_id!: string;

  type!: string;

  sequence!: number;

  sequence_key!: string;

  data!: any;

  static get tableName() {
    return 'ibc_message';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'transaction_message_id',
        'src_channel_id',
        'src_port_id',
        'dst_channel_id',
        'dst_port_id',
        'type',
        'sequence',
        'sequence_key',
      ],
      properties: {
        transaction_message_id: { type: 'number' },
        src_channel_id: { type: 'string' },
        src_port_id: { type: 'string' },
        dst_channel_id: { type: 'string' },
        dst_port_id: { type: 'string' },
        type: { type: 'string' },
        sequence: { type: 'number' },
        sequence_key: { type: 'string' },
        status: { type: 'boolean' },
      },
    };
  }

  static get relationMappings() {
    return {
      message: {
        relation: Model.BelongsToOneRelation,
        modelClass: TransactionMessage,
        join: {
          from: 'ibc_message.transaction_message_id',
          to: 'transaction_message.id',
        },
      },
      src_channel: {
        relation: Model.BelongsToOneRelation,
        modelClass: IbcChannel,
        join: {
          from: 'ibc_message.src_channel_id',
          to: 'ibc_channel.id',
        },
      },
      dst_channel: {
        relation: Model.BelongsToOneRelation,
        modelClass: IbcChannel,
        join: {
          from: 'ibc_message.dst_channel_id',
          to: 'ibc_channel.id',
        },
      },
    };
  }

  static EVENT_TYPE = {
    SEND_PACKET: 'send_packet',
    RECV_PACKET: 'recv_packet',
    ACKNOWLEDGE_PACKET: 'acknowledge_packet',
    TIMEOUT_PACKET: 'timeout_packet',
  };
}
