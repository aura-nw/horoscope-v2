import BaseModel from './base';

export class IbcProgress extends BaseModel {
  id!: number;

  tx_send_hash!: string;

  tx_receive_hash!: string;

  tx_ack_hash!: string;

  tx_timeout_hash!: string;

  channel_id!: string;

  packet_sequence!: string;

  packet_data!: any;

  static get tableName() {
    return 'ibc_progress';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['channel_id', 'packet_sequence', 'packet_data'],
      properties: {
        channel_id: { type: 'string' },
        packet_sequence: { type: 'string' },
      },
    };
  }
}
