import Long from 'long';

export interface INetworkInfo {
  chainName: string;
  chainId: string;
  RPC: string[];
  LCD: string[];
  prefixAddress: string;
  databaseName: string;
}

export interface ICoin {
  denom: string;
  amount: string;
}

export interface Pagination {
  limit?: Long;
  key?: Uint8Array;
}

export interface DelegatorDelegationsRequest {
  delegatorAddr: string;
  pagination?: Pagination;
}

export interface DelegatorRedelegationsRequest {
  delegatorAddr: string;
  srcValidatorAddr: string;
  dstValidatorAddr: string;
  pagination?: Pagination;
}

export interface DelegatorUnbondingRequest {
  delegatorAddr: string;
  pagination?: Pagination;
}

export interface AllBalancesRequest {
  address: string;
  pagination?: Pagination;
}
