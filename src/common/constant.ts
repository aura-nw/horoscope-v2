import {
  calculateFee,
  GasPrice,
  SigningStargateClientOptions,
} from '@cosmjs/stargate';

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
  HANDLE_VESTING_ACCOUNT: 'handle:vesting-account',
  HANDLE_STAKE_EVENT: 'handle:stake-event',
  CRAWL_ACCOUNT_DELEGATIONS: 'crawl:account-delegations',
  CRAWL_ACCOUNT_REDELEGATIONS: 'crawl:account-redelegations',
  CRAWL_ACCOUNT_UNBONDING: 'crawl:account-unbonding',
  HANDLE_EXPIRED_ACCOUNT_STAKE: 'handle:expired-account-stake',
  CRAWL_BLOCK: 'crawl:block',
  CRAWL_TRANSACTION: 'crawl:transaction',
  HANDLE_TRANSACTION: 'handle:transaction',
};

export const SERVICE = {
  V1: {
    CrawlAccountService: {
      key: 'CrawlAccountService',
      name: 'v1.CrawlAccountService',
      UpdateAccount: {
        key: 'UpdateAccount',
        path: 'v1.CrawlAccountService.UpdateAccount',
      },
    },
    HandleAddressService: {
      key: 'HandleAddressService',
      name: 'v1.HandleAddressService',
      CrawlNewAccountApi: {
        key: 'CrawlNewAccountApi',
        path: 'v1.HandleAddressService.CrawlNewAccountApi',
      },
    },
    CrawlAccountStakeService: {
      key: 'CrawlAccountStakeService',
      name: 'v1.CrawlAccountStakeService',
      UpdateAccountStake: {
        key: 'UpdateAccountStake',
        path: 'v1.CrawlAccountStakeService.UpdateAccountStake',
      },
    },
    HandleStakeEventService: {
      key: 'HandleStakeEventService',
      name: 'v1.HandleStakeEventService',
      UpdatePowerEvent: {
        key: 'UpdatePowerEvent',
        path: 'v1.HandleStakeEventService.UpdatePowerEvent',
      },
    },
    CrawlValidatorService: {
      key: 'CrawlValidatorService',
    },
    CrawlSigningInfoService: {
      key: 'CrawlSigningInfoService',
    },
  },
};

export const SERVICE_NAME = {
  CRAWL_BLOCK: 'CrawlBlockService',
  CRAWL_TRANSACTION: 'CrawlTransaction',
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

export const MSG_TYPE = {
  MSG_STORE_CODE: '/cosmwasm.wasm.v1.MsgStoreCode',
  MSG_INSTANTIATE_CONTRACT: '/cosmwasm.wasm.v1.MsgInstantiateContract',
  MSG_EXECUTE_CONTRACT: '/cosmwasm.wasm.v1.MsgExecuteContract',
  MSG_UPDATE_CLIENT: '/ibc.core.client.v1.MsgUpdateClient',
  MSG_DELEGATE: '/cosmos.staking.v1beta1.MsgDelegate',
  MSG_REDELEGATE: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
  MSG_UNDELEGATE: '/cosmos.staking.v1beta1.MsgUndelegate',
};

export const ABCI_QUERY_PATH = {
  VALIDATOR_DELEGATION: '/cosmos.staking.v1beta1.Query/Delegation',
};

export const defaultSigningClientOptions: SigningStargateClientOptions = {
  broadcastPollIntervalMs: 300,
  broadcastTimeoutMs: 8_000,
  gasPrice: GasPrice.fromString('0.05uaura'),
};
export const defaultGasPrice = GasPrice.fromString('0.05uaura');
export const defaultSendFee = calculateFee(200_000, defaultGasPrice);
