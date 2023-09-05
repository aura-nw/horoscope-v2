/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import BaseModel from './base';
import { IbcMessage } from './ibc_message';
import { IbcChannel } from './ibc_channel';

export class IbcIcs20 extends BaseModel {
  id!: number;

  ibc_message_id!: number;

  sender!: string;

  receiver!: string;

  amount!: string;

  denom!: string;

  status!: boolean;

  channel_id!: string;

  ibc_message!: IbcMessage;

  static get tableName() {
    return 'ibc_ics20';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['receiver', 'amount', 'denom', 'ibc_message_id', 'channel_id'],
      properties: {
        receiver: { type: 'string' },
        denom: { type: 'string' },
        ibc_message_id: { type: 'number' },
        amount: { type: 'string' },
        channel_id: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      ibc_message: {
        relation: Model.BelongsToOneRelation,
        modelClass: IbcMessage,
        join: {
          from: 'ibc_ics20.ibc_message_id',
          to: 'ibc_message.id',
        },
      },
      channel: {
        relation: Model.BelongsToOneRelation,
        modelClass: IbcChannel,
        join: {
          from: 'ibc_ics20.channel_id',
          to: 'ibc_channel.channel_id',
        },
      },
    };
  }

  static EVENT_TYPE = {
    TIMEOUT: 'timeout',
    FUNGIBLE_TOKEN_PACKET: 'fungible_token_packet',
    DENOM_TRACE: 'denomination_trace',
  };
}
