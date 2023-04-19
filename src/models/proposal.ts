/* eslint-disable import/no-cycle */
import { Model } from 'objection';
import { ICoin } from '../common/types/interfaces';
import { Account } from './account';
import BaseModel from './base';

export interface ITally {
  yes: string;
  no: string;
  abstain: string;
  no_with_veto: string;
}

export class Proposal extends BaseModel {
  proposal_id!: number;

  proposer_id!: number;

  voting_start_time!: string;

  voting_end_time!: string;

  submit_time!: string;

  deposit_end_time!: string;

  type!: string;

  title!: string;

  description!: string;

  content!: JSON;

  status!: string;

  tally!: ITally;

  initial_deposit!: ICoin[];

  total_deposit!: ICoin[];

  turnout!: number;

  static get tableName() {
    return 'proposal';
  }

  static get jsonAttributes() {
    return ['content', 'tally', 'initial_deposit', 'total_deposit'];
  }

  static get STATUS() {
    return {
      PROPOSAL_STATUS_UNSPECIFIED: 'PROPOSAL_STATUS_UNSPECIFIED',
      PROPOSAL_STATUS_DEPOSIT_PERIOD: 'PROPOSAL_STATUS_DEPOSIT_PERIOD',
      PROPOSAL_STATUS_VOTING_PERIOD: 'PROPOSAL_STATUS_VOTING_PERIOD',
      PROPOSAL_STATUS_PASSED: 'PROPOSAL_STATUS_PASSED',
      PROPOSAL_STATUS_REJECTED: 'PROPOSAL_STATUS_REJECTED',
      PROPOSAL_STATUS_FAILED: 'PROPOSAL_STATUS_FAILED',
      PROPOSAL_STATUS_NOT_ENOUGH_DEPOSIT: 'PROPOSAL_STATUS_NOT_ENOUGH_DEPOSIT',
    };
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'proposal_id',
        'proposer_id',
        'voting_start_time',
        'voting_end_time',
        'submit_time',
        'deposit_end_time',
        'type',
        'title',
        'description',
        'content',
        'status',
        'tally',
        'initial_deposit',
        'total_deposit',
        'turnout',
      ],
      properties: {
        proposal_id: { type: 'number' },
        proposer_id: { type: 'number' },
        voting_start_time: { type: 'string', format: 'date-time' },
        voting_end_time: { type: 'string', format: 'date-time' },
        submit_time: { type: 'string', format: 'date-time' },
        deposit_end_time: { type: 'string', format: 'date-time' },
        type: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        tally: {
          type: 'object',
          properties: {
            yes: { type: 'string' },
            no: { type: 'string' },
            abstain: { type: 'string' },
            no_with_veto: { type: 'string' },
          },
        },
        initial_deposit: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              denom: { type: 'string' },
              amount: { type: 'string' },
            },
          },
        },
        total_deposit: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              denom: { type: 'string' },
              amount: { type: 'string' },
            },
          },
        },
        turnout: { type: 'number' },
      },
    };
  }

  static get relationMappings() {
    return {
      proposer: {
        relation: Model.BelongsToOneRelation,
        modelClass: Account,
        join: {
          from: 'proposal.proposer_id',
          to: 'account.id',
        },
      },
    };
  }
}
