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
export interface IContractAndInfo {
  sender: string;
  contractAddress: string;
  action: string;
  txhash: string;
  tokenid?: string;
  contractInfo?: any;
}
export interface ICodeidType {
  code_id: number;
  contract_type: string;
}

export interface IAttribute {
  key: string;
  value: string;
}
export interface IEvent {
  type: string;
  attributes: IAttribute[];
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
