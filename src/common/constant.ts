import * as fs from 'fs';
import { INetworkInfo } from './types/interfaces';

export const URL_TYPE_CONSTANTS = {
  LCD: 'LCD',
  RPC: 'RPC',
};

export const PROPOSAL_STATUS = {
  PROPOSAL_STATUS_UNSPECIFIED: 'PROPOSAL_STATUS_UNSPECIFIED',
  PROPOSAL_STATUS_DEPOSIT_PERIOD: 'PROPOSAL_STATUS_DEPOSIT_PERIOD',
  PROPOSAL_STATUS_VOTING_PERIOD: 'PROPOSAL_STATUS_VOTING_PERIOD',
  PROPOSAL_STATUS_PASSED: 'PROPOSAL_STATUS_PASSED',
  PROPOSAL_STATUS_REJECTED: 'PROPOSAL_STATUS_REJECTED',
  PROPOSAL_STATUS_FAILED: 'PROPOSAL_STATUS_FAILED',
  PROPOSAL_STATUS_NOT_ENOUGH_DEPOSIT: 'PROPOSAL_STATUS_NOT_ENOUGH_DEPOSIT',
};

export const EVENT_TYPE = {
  WASM: 'wasm',
  EXECUTE: 'execute',
};

export const CONTRACT_TYPE = {
  CW721: 'CW721',
  CW20: 'CW20',
  CW4973: 'CW4973',
};

export const ENRICH_TYPE = {
  INSERT: 'insert',
  UPSERT: 'upsert',
};

export const CODEID_MANAGER_ACTION = {
  UPDATE_MANY: 'v1.codeid-manager.act-updateMany',
  FIND: 'v1.codeid-manager.act-find',
  // FIND: 'v1.codeid-manager.findByCondition',
  CHECK_STATUS: 'v1.codeid-manager.checkStatus',
  // CREATE: 'v1.codeid-manager.act-create',
  INSERT: 'v1.codeid-manager.act-insert',
};

export const BASE_64_ENCODE = {
  RECIPIENT: 'cmVjaXBpZW50',
  SENDER: 'c2VuZGVy',
  ACTION: 'YWN0aW9u',
  BURN: 'YnVybg==',
  _CONTRACT_ADDRESS: 'X2NvbnRyYWN0X2FkZHJlc3M=',
  TOKEN_ID: 'dG9rZW5faWQ=',
  VALIDATOR: 'dmFsaWRhdG9y',
  AMOUNT: 'YW1vdW50',
  SOURCE_VALIDATOR: 'c291cmNlX3ZhbGlkYXRvcg==',
  DESTINATION_VALIDATOR: 'ZGVzdGluYXRpb25fdmFsaWRhdG9y',
};

export const CW20_ACTION = {
  URL_GET_OWNER_LIST: 'eyJhbGxfYWNjb3VudHMiOiB7fX0=',
  URL_GET_TOKEN_INFO: 'eyJ0b2tlbl9pbmZvIjoge319',
  URL_GET_MARKETING_INFO: 'eyJtYXJrZXRpbmdfaW5mbyI6IHt9fQ==',
  GET_OWNER_LIST: 'v1.CW20.getOwnerList',
  GET_BALANCE: 'v1.CW20.getBalance',
  ENRICH_DATA: 'v1.CW20.enrichData',
  GET_MARKET_INFO: 'v1.CW20.getMarketInfo',
};

export const LIST_NETWORK: INetworkInfo[] = JSON.parse(
  fs.readFileSync('network.json').toString()
);
