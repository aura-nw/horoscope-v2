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
  startId: number;
  endId: number;
  date: string;
  offset: number;
  addresses: string[];
}

export interface IAccountStatsParam {
  startId: number;
  endId: number;
  date: string;
  accountStats: any;
}

export interface ICreateSpecificDateJob {
  date: string;
}
