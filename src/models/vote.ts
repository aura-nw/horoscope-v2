import BaseModel from './base';

export class Vote extends BaseModel {
  voter!: string;

  txhash!: string;

  vote_option!: string;

  proposal_id!: number;

  height!: number;

  tx_id!: number;

  static get tableName() {
    return 'vote';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'voter',
        'txhash',
        'vote_option',
        'proposal_id',
        'height',
        'tx_id',
      ],
      properties: {
        voter: { type: 'string' },
        txhash: { type: 'string' },
        vote_option: { type: 'string' },
        proposal_id: { type: 'number' },
        height: { type: 'number' },
        tx_id: { type: 'number' },
      },
    };
  }
}
