import Long from 'long';

export interface IAuraJSClientFactory {
  auranw: any;
  cosmwasm: any;
  ibc: any;
}

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

export interface IPagination {
  limit?: Long;
  key?: Uint8Array;
}

export interface IDelegatorDelegations {
  delegatorAddr: string;
  pagination?: IPagination;
}

export interface IDelegatorRedelegations {
  delegatorAddr: string;
  srcValidatorAddr: string;
  dstValidatorAddr: string;
  pagination?: IPagination;
}

export interface IDelegatorUnbonding {
  delegatorAddr: string;
  pagination?: IPagination;
}

export interface IAllBalances {
  address: string;
  pagination?: IPagination;
}

export interface IValidatorDelegators {
  id: number;
  address: string;
  height: number;
}

export interface IStoreCodes {
  hash: string;
  height: number;
  codeId: Long;
}

export interface IContextStoreCodes {
  codeIds: IStoreCodes[];
}

export interface IContextGetContractInfo {
  addresses: string[];
}
