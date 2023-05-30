export const REDIS_KEY = {
  IBC_DENOM: 'ibc_denom',
};

export const URL_TYPE_CONSTANTS = {
  LCD: 'LCD',
  RPC: 'RPC',
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
  CRAWL_BLOCK: 'crawl:block',
  CRAWL_TRANSACTION: 'crawl:transaction',
  HANDLE_TRANSACTION: 'handle:transaction',
  HANDLE_CW721_TRANSACTION: 'handle:cw721-tx',
  CRAWL_PROPOSAL: 'crawl:proposal',
  CRAWL_TALLY_PROPOSAL: 'crawl:tally-proposal',
  HANDLE_NOT_ENOUGH_DEPOSIT_PROPOSAL: 'handle:not-enough-deposit-proposal',
  HANDLE_ENDED_PROPOSAL: 'handle:ended-proposal',
  CRAWL_GENESIS: 'crawl:genesis',
  CRAWL_CODE: 'crawl:code',
  CRAWL_SMART_CONTRACT: 'crawl:smart-contract',
  CRAWL_GENESIS_PROPOSAL: 'crawl:genesis-proposal',
  CRAWL_GENESIS_CODE: 'crawl:genesis-code',
  CRAWL_GENESIS_CONTRACT: 'crawl:genesis-contract',
  HANDLE_AUTHZ_TX: 'handle:authz-tx',
  HANDLE_VOTE_TX: 'handle:vote-tx',
  CRAWL_DELEGATORS: 'crawl:delegators',
  CRAWL_VALIDATOR_DELEGATORS: 'crawl:validator-delegators',
  CRAWL_CONTRACT_EVENT: 'crawl:contract-event',
  FILTER_TOKEN_MEDIA_UNPROCESS: 'filter:cw721-token-media-unprocess',
  HANDLE_CW721_TOKEN_MEDIA: 'handle:cw721-token-media',
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
    Cw721: {
      key: 'Cw721Service',
      name: 'v1.Cw721Service',
      HandleCw721: {
        key: 'handleCw721',
        path: 'v1.Cw721Service.handleCw721',
      },
      UpdateMedia: {
        key: 'updateCw721Media',
        path: 'v1.Cw721Service.updateCw721Media',
      },
    },
    CrawlProposalService: {
      name: 'v1.CrawlProposalService',
      key: 'CrawlProposalService',
    },
    CrawlTallyProposalService: {
      name: 'v1.CrawlTallyProposalService',
      key: 'CrawlTallyProposalService',
    },
    HandleStakeEventService: {
      key: 'HandleStakeEventService',
      name: 'v1.HandleStakeEventService',
    },
    CrawlValidatorService: {
      key: 'CrawlValidatorService',
    },
    CrawlSigningInfoService: {
      key: 'CrawlSigningInfoService',
    },
    CrawlBlock: {
      key: 'CrawlBlockService',
      name: 'v1.CrawlBlockService',
    },
    CrawlTransaction: {
      key: 'CrawlTransactionService',
      name: 'v1.CrawlTransactionService',
      CrawlTxByHeight: {
        key: 'CrawlTxByHeight',
        path: 'v1.CrawlTransactionService.CrawlTxByHeight',
      },
    },
    CrawlGenesisService: {
      key: 'CrawlGenesisService',
      name: 'v1.CrawlGenesisService',
    },
    CrawlCodeService: {
      key: 'CrawlCodeService',
      name: 'v1.CrawlCodeService',
      CrawlMissingCode: {
        key: 'CrawlMissingCode',
        path: 'v1.CrawlCodeService.CrawlMissingCode',
      },
    },
    CrawlSmartContractService: {
      key: 'CrawlSmartContractService',
      name: 'v1.CrawlSmartContractService',
      CrawlContractEventService: {
        key: 'CrawlContractEventService',
        name: 'v1.CrawlContractEventService',
      },
    },
    HandleAuthzTx: {
      key: 'HandleAuthzTxService',
      name: 'v1.HandleAuthzTxService',
    },
    HandleVoteTx: {
      key: 'HandleVoteTxService',
      name: 'v1.HandleVoteTxService',
    },
    CrawlDelegatorsService: {
      key: 'CrawlDelegatorsService',
      name: 'v1.CrawlDelegatorsService',
    },
  },
};

export enum AccountType {
  CONTINUOUS_VESTING = '/cosmos.vesting.v1beta1.ContinuousVestingAccount',
  PERIODIC_VESTING = '/cosmos.vesting.v1beta1.PeriodicVestingAccount',
  DELAYED_VESTING = '/cosmos.vesting.v1beta1.DelayedVestingAccount',
  MODULE = '/cosmos.auth.v1beta1.ModuleAccount',
  BASE = '/cosmos.auth.v1beta1.BaseAccount',
}

export const BLOCK_CHECKPOINT_JOB_NAME = {
  CW721_HANDLER: 'CW721_HANDLER',
};

export const MSG_TYPE = {
  MSG_STORE_CODE: '/cosmwasm.wasm.v1.MsgStoreCode',
  MSG_INSTANTIATE_CONTRACT: '/cosmwasm.wasm.v1.MsgInstantiateContract',
  MSG_INSTANTIATE2_CONTRACT: '/cosmwasm.wasm.v1.MsgInstantiateContract2',
  MSG_EXECUTE_CONTRACT: '/cosmwasm.wasm.v1.MsgExecuteContract',
  MSG_UPDATE_CLIENT: '/ibc.core.client.v1.MsgUpdateClient',
  MSG_DELEGATE: '/cosmos.staking.v1beta1.MsgDelegate',
  MSG_REDELEGATE: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
  MSG_UNDELEGATE: '/cosmos.staking.v1beta1.MsgUndelegate',
  MSG_CREATE_VALIDATOR: '/cosmos.staking.v1beta1.MsgCreateValidator',
  MSG_SUBMIT_PROPOSAL: '/cosmos.gov.v1beta1.MsgSubmitProposal',
  MSG_AUTHZ_EXEC: '/cosmos.authz.v1beta1.MsgExec',
  MSG_VOTE: '/cosmos.gov.v1beta1.MsgVote',
  MSG_ACKNOWLEDGEMENT: '/ibc.core.channel.v1.MsgAcknowledgement',
  MSG_GRANT_ALLOWANCE: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
};

export const ABCI_QUERY_PATH = {
  ACCOUNT_ALL_BALANCES: '/cosmos.bank.v1beta1.Query/AllBalances',
  ACCOUNT_SPENDABLE_BALANCES: '/cosmos.bank.v1beta1.Query/SpendableBalances',
  DENOM_TRACE: '/ibc.applications.transfer.v1.Query/DenomTrace',
  VALIDATOR_DELEGATION: '/cosmos.staking.v1beta1.Query/Delegation',
  PROPOSAL: '/cosmos.gov.v1beta1.Query/Proposal',
  TALLY_RESULT: '/cosmos.gov.v1beta1.Query/TallyResult',
  CODE: '/cosmwasm.wasm.v1.Query/Code',
  RAW_CONTRACT_STATE: '/cosmwasm.wasm.v1.Query/RawContractState',
  CONTRACT_INFO: '/cosmwasm.wasm.v1.Query/ContractInfo',
  GET_TXS_EVENT: '/cosmos.tx.v1beta1.Service/GetTxsEvent',
};
