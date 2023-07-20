export interface IAddressesParam {
  addresses: string[];
}

export interface IProposalIdParam {
  proposalId: number;
}
export interface ITxIdsParam {
  txIds: number[];
}

export interface IDailyStatsParam {
  date: string;
  offset: number;
  txIds: number[];
  addresses: string[];
}

export interface IAccountStatsParam {
  id: number;
  date: string;
  accountStats: any;
}

export interface ICreateSpecificDateJob {
  date: string;
}
