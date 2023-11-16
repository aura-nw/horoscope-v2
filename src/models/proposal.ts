/* eslint-disable import/no-cycle */
import { ICoin } from '../common/types/interfaces';
import BaseModel from './base';
import knex from '../common/utils/db_connection';
import { Transaction } from './transaction';
import { Event } from './event';
import { MSG_TYPE } from '../common';
import { EventAttribute } from './event_attribute';

export interface ITally {
  yes: string;
  no: string;
  abstain: string;
  no_with_veto: string;
}

export interface ICountVote {
  yes: number;
  no: number;
  abstain: number;
  no_with_veto: number;
  unspecified: number;
}

export class Proposal extends BaseModel {
  proposal_id!: number;

  proposer_address: string | undefined;

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

  turnout: number | undefined;

  count_vote!: ICountVote;

  vote_counted!: boolean;

  static get tableName() {
    return 'proposal';
  }

  static get jsonAttributes() {
    return [
      'content',
      'tally',
      'initial_deposit',
      'total_deposit',
      'count_vote',
    ];
  }

  static get idColumn(): string | string[] {
    return 'proposal_id';
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
        'vote_counted',
      ],
      properties: {
        proposal_id: { type: 'number' },
        proposer_address: { type: ['string', 'null'] },
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
        turnout: { type: ['number', 'null'] },
        vote_counted: { type: 'boolean' },
      },
    };
  }

  static get relationMappings() {
    return {};
  }

  static createNewProposal(
    proposal: any,
    proposerAddress?: string,
    initialDeposit?: ICoin[]
  ) {
    return Proposal.fromJson({
      proposal_id: proposal.proposal_id,
      proposer_address: proposal.proposer_address ?? proposerAddress ?? null,
      voting_start_time: proposal.voting_start_time,
      voting_end_time: proposal.voting_end_time,
      submit_time: proposal.submit_time,
      deposit_end_time: proposal.deposit_end_time,
      type:
        proposal.content['@type'] ??
        proposal.messages.map((msg: string) => msg['@type']).join(','),
      title: proposal.content.title ?? proposal.title ?? '',
      description: proposal.content.description ?? proposal.description ?? '',
      content: proposal.content,
      status: proposal.status,
      tally: proposal.final_tally_result,
      initial_deposit: initialDeposit ?? [],
      total_deposit: proposal.total_deposit,
      turnout: null,
      vote_counted: false,
    });
  }

  static async getProposerBySearchTx(proposalId: string) {
    const tx: any = await Transaction.query()
      .joinRelated('[messages, events.[attributes]]')
      .where('transaction.code', 0)
      // .andWhere('messages.type', MSG_TYPE.MSG_SUBMIT_PROPOSAL)
      .andWhere((builder) => {
        builder.whereIn('messages.type', [
          MSG_TYPE.MSG_SUBMIT_PROPOSAL,
          MSG_TYPE.MSG_SUBMIT_PROPOSAL_V1,
        ]);
      })
      .andWhere('events.type', Event.EVENT_TYPE.SUBMIT_PROPOSAL)
      .andWhere(
        'events:attributes.key',
        EventAttribute.ATTRIBUTE_KEY.PROPOSAL_ID
      )
      .andWhere('events:attributes.value', proposalId)
      .andWhere(knex.raw('messages.index = events.tx_msg_index'))
      .select('messages.content')
      .first();

    const initialDeposit = tx?.content.initial_deposit;
    const proposerAddress = tx?.content.proposer;

    return [proposerAddress, initialDeposit];
  }
}
