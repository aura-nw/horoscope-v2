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
  CRAWL_VALIDATOR: 'crawl:validator',
  CRAWL_GENESIS_VALIDATOR: 'crawl:genesis-validator',
  CRAWL_SIGNING_INFO: 'crawl:signing-info',
  HANDLE_ADDRESS: 'handle:address',
  CRAWL_GENESIS_ACCOUNT: 'crawl:genesis-account',
  CRAWL_ACCOUNT_AUTH: 'crawl:account-auth',
  CRAWL_ACCOUNT_BALANCES: 'crawl:account-balances',
  CRAWL_ACCOUNT_SPENDABLE_BALANCES: 'crawl:account-spendable-balances',
  CRAWL_BLOCK: 'crawl:block',
  CRAWL_TRANSACTION: 'crawl:transaction',
  HANDLE_TRANSACTION: 'handle:transaction',
  HANDLE_ASSET_TRANSACTION: 'handle:asset-tx',
  HANDLE_CW721: 'handle:cw721',
  HANDLE_CW721_TRANSFER: 'handle:cw721-transfer',
  HANDLE_CW721_MINT: 'handle:cw721-mint',
  HANDLE_CW721_BURN: 'handle:cw721-burn',
  ENRICH_CW20: 'enrich:cw20',
};

export const SERVICE = {
  V1: {
    CrawlAccount: {
      name: 'v1.CrawlAccountService',
      UpdateAccount: {
        key: 'UpdateAccount',
        path: 'v1.CrawlAccountService.UpdateAccount',
      },
    },
    HandleAddress: {
      name: 'v1.HandleAddressService',
      CrawlNewAccountApi: {
        key: 'CrawlNewAccountApi',
        path: 'v1.HandleAddressService.CrawlNewAccountApi',
      },
    },
    Cw721: {
      name: 'v1.Cw721Service',
      HandleCw721: {
        key: 'handleCw721',
        path: 'v1.Cw721Service.handleCw721',
      },
    },
    CrawlBlock: {
      name: 'v1.CrawlBlockService',
    },
    CrawlTransaction: {
      name: 'v1.CrawlTransactionService',
      CrawlTxByHeight: {
        key: 'CrawlTxByHeight',
        path: 'v1.CrawlTransactionService.CrawlTxByHeight',
      },
    },
  },
};

export const SERVICE_NAME = {
  CRAWL_VALIDATOR: 'CrawlValidatorService',
  CRAWL_SIGNING_INFO: 'CrawlSigningInfoService',
  HANDLE_ADDRESS: 'HandleAddressService',
  CRAWL_ACCOUNT: 'CrawlAccountService',
  CRAWL_BLOCK: 'CrawlBlockService',
  ASSET_INDEXER: 'AssetTxIndexerService',
  CW721: 'Cw721Service',
  CRAWL_TRANSACTION: 'CrawlTransactionService',
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
  TX_ASSET_HANDLER: 'TX_ASSET_HANDLER',
};

export const MSG_TYPE = {
  MSG_STORE_CODE: '/cosmwasm.wasm.v1.MsgStoreCode',
  MSG_INSTANTIATE_CONTRACT: '/cosmwasm.wasm.v1.MsgInstantiateContract',
  MSG_EXECUTE_CONTRACT: '/cosmwasm.wasm.v1.MsgExecuteContract',
  MSG_UPDATE_CLIENT: '/ibc.core.client.v1.MsgUpdateClient',
};

export const EVENT_TYPE = {
  WASM: 'wasm',
  EXECUTE: 'execute',
  INSTANTIATE: 'instantiate',
};

export const ABCI_QUERY_PATH = {
  VALIDATOR_DELEGATION: '/cosmos.staking.v1beta1.Query/Delegation',
};

export const CW721_ACTION = {
  MINT: 'mint',
  BURN: 'burn',
  TRANSFER: 'transfer',
  INSTANTIATE: 'instantiate',
};
