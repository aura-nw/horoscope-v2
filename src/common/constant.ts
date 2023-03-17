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
  CRAWL_SIGNING_INFO: 'crawl.signing-info',
};

export const BULL_ACTION_NAME = {
  VALIDATOR_UPSERT: 'validator.upsert',
};

export const SERVICE_NAME = {
  CRAWL_VALIDATOR: 'CrawlValidatorService',
  CRAWL_SIGNING_INFO: 'CrawlSigningInfoService',
  CRAWL_PROPOSAL: 'CrawlProposalService',
};

export const BLOCK_CHECKPOINT_JOB_NAME = {
  BLOCK_HEIGHT_CRAWLED: 'BLOCK_HEIGHT_CRAWLED',
};
