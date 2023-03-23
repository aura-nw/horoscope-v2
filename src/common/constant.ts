export const CONST_CHAR = {
  VERSION_NUMBER: 1,
  VERSION: 'v1',
  BALANCES: 'balances',
  DELEGATION_RESPONSES: 'delegation_responses',
  REDELEGATION_RESPONSES: 'redelegation_responses',
  UNBONDING_RESPONSES: 'unbonding_responses',
  MESSAGE: 'message',
  ACTION: 'action',
  TRANSFER: 'transfer',
  SENDER: 'sender',
  RECEIVER: 'receiver',
  SPENDER: 'spender',
  CRAWL: 'crawl',
  API: 'api',
  RECIPIENT: 'recipient',
  COIN_RECEIVED: 'coin_received',
  COIN_SPENT: 'coin_spent',
  WITHDRAW_REWARDS: 'withdraw_rewards',
  AMOUNT: 'amount',
  VALIDATOR: 'validator',
  SOURCE_VALIDATOR: 'source_validator',
  DESTINATION_VALIDATOR: 'destination_validator',
  RECV_PACKET: 'recv_packet',
  PACKET_DATA: 'packet_data',
  INSTANTIATE: 'instantiate',
  _CONTRACT_ADDRESS: '_contract_address',
  CODE_ID: 'code_id',
  EXECUTE: 'execute',
};

export const REDIS_KEY = {
  IBC_DENOM: 'ibc_denom',
};

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

export const MODULE_PARAM = {
  BANK: 'bank',
  GOVERNANCE: 'gov',
  DISTRIBUTION: 'distribution',
  STAKING: 'staking',
  SLASHING: 'slashing',
  IBC_TRANSFER: 'ibc-transfer',
  MINT: 'mint',
};

export const BULL_JOB_NAME = {
  CRAWL_VALIDATOR: 'crawl.validator',
  CRAWL_GENESIS_VALIDATOR: 'crawl.genesis-validator',
  CRAWL_SIGNING_INFO: 'crawl.signing-info',
  HANDLE_ADDRESS: 'handle.address',
  CRAWL_GENESIS_ACCOUNT: 'crawl.genesis-account',
  CRAWL_ACCOUNT_AUTH: 'crawl.account-auth',
  CRAWL_ACCOUNT_BALANCES: 'crawl.account-balances',
  CRAWL_ACCOUNT_SPENDABLE_BALANCES: 'crawl.account-spendable-balances',
};

export const BULL_ACTION_NAME = {
  VALIDATOR_UPSERT: 'validator.upsert',
  ACCOUNT_UPSERT: 'account.upsert',
};

export const SERVICE_NAME = {
  CRAWL_VALIDATOR: 'CrawlValidatorService',
  CRAWL_SIGNING_INFO: 'CrawlSigningInfoService',
  HANDLE_ADDRESS: 'HandleAddressService',
  CRAWL_ACCOUNT: 'CrawlAccountService',
};

export enum AccountType {
  CONTINUOUS_VESTING = '/cosmos.vesting.v1beta1.ContinuousVestingAccount',
  PERIODIC_VESTING = '/cosmos.vesting.v1beta1.PeriodicVestingAccount',
  DELAYED_VESTING = '/cosmos.vesting.v1beta1.DelayedVestingAccount',
  MODULE = '/cosmos.auth.v1beta1.ModuleAccount',
  BASE = '/cosmos.auth.v1beta1.BaseAccount',
}

export const BLOCK_CHECKPOINT_JOB_NAME = {
  BLOCK_HEIGHT_CRAWLED: 'BLOCK_HEIGHT_CRAWLED',
};
