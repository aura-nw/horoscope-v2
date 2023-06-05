import BaseModel from './base';

export class Vote extends BaseModel {
  voter!: string;

  txhash!: string;

  vote_option!: string;

  proposal_id!: number;

  height!: number;

  tx_id!: number;

  [key: string]: any;

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

  static get VOTE_OPTION() {
    return {
      VOTE_OPTION_UNSPECIFIED: 'VOTE_OPTION_UNSPECIFIED',
      VOTE_OPTION_YES: 'VOTE_OPTION_YES',
      VOTE_OPTION_ABSTAIN: 'VOTE_OPTION_ABSTAIN',
      VOTE_OPTION_NO: 'VOTE_OPTION_NO',
      VOTE_OPTION_NO_WITH_VETO: 'VOTE_OPTION_NO_WITH_VETO',
    };
  }
}
