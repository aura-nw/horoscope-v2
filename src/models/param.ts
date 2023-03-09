/* eslint-disable max-classes-per-file */
import { ICoin } from '../common/types/interfaces';
import BaseModel from './base';

export interface ISendEnabled {
  denom: string;
  enabled: boolean;
}

export interface IBankParam {
  send_enabled: ISendEnabled[];
  default_send_enabled: boolean;
}

export interface IGovVotingParam {
  votingPeriod: string;
}

export interface IGovDepositParam {
  min_deposit: ICoin[];
  max_deposit_period: string;
}
export interface IGovTallyParam {
  quorum: string;
  threshold: string;
  vetoThreshold: string;
}

export interface IGovParam {
  voting_param: IGovVotingParam;
  deposit_param: IGovDepositParam;
  tally_param: IGovTallyParam;
}

export interface IDistributionParam {
  community_tax: string;
  base_proposer_reward: string;
  bonus_proposer_reward: string;
  withdraw_addr_enabled: string;
}

export interface ISlashingParam {
  signed_blocks_window: string;
  min_signed_per_window: string;
  downtime_jail_duration: string;
  slash_fraction_double_sign: string;
  slash_fraction_downtime: string;
}

export interface IStakingParam {
  unbonding_time: string;
  max_validators: number;
  max_entries: number;
  historical_entries: number;
  bond_denom: string;
}

export interface IIbcTransferParam {
  send_enabled: boolean;
  receive_enabled: boolean;
}

export interface IMintParam {
  mint_denom: string;
  inflation_rate_change: string;
  inflation_max: string;
  inflation_min: string;
  goal_bonded: string;
  blocks_per_year: string;
}

export class SlashingParam implements ISlashingParam {
  signed_blocks_window!: string;

  min_signed_per_window!: string;

  downtime_jail_duration!: string;

  slash_fraction_double_sign!: string;

  slash_fraction_downtime!: string;
}

export class Param extends BaseModel {
  module!: string;

  params!:
    | IBankParam
    | IGovParam
    | IDistributionParam
    | ISlashingParam
    | IStakingParam
    | IIbcTransferParam
    | IMintParam
    | null;

  static get tableName() {
    return 'param';
  }

  static get jsonAttributes() {
    return ['params'];
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['module', 'params'],
      properties: {
        module: {
          type: 'string',
        },
      },
    };
  }
}
