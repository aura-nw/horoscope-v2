import { Knex } from 'knex';

export interface IAddressesParam {
  addresses: string[];
  trx: Knex.Transaction;
}

export interface IProposalIdParam {
  proposalId: number;
}
export interface ITxIdsParam {
  txIds: number[];
}

export interface IStatisticsParam {
  date: string;
}

export interface ICreateSpecificDateJob {
  date: string;
}
