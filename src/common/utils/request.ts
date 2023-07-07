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
  accountStats: IAccountStats[];
}

export interface IAccountStats {
  address: string;
  amount_sent: string;
  amount_received: string;
  tx_sent: number;
  gas_used: string;
}

export interface ICreateSpecificDateJob {
  date: string;
}
