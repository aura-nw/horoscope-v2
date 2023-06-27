import { Knex } from 'knex';
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

export interface IInstantiateContracts {
  address: string;
  hash: string;
  height: number;
}

export interface IContextInstantiateContracts {
  contracts: IInstantiateContracts[];
}

export interface IContextGraphQLQuery {
  operationName: string;
  query: string;
  variables: any;
}

export interface IContextUpdateCw20 {
  cw20Contracts: {
    id: number;
    last_updated_height: number;
  }[];
  startBlock: number;
  endBlock: number;
}

export interface IContextCrawlMissingContractHistory {
  smartContractId: number;
  startBlock: number;
  endBlock: number;
  trx: Knex.Transaction;
}
