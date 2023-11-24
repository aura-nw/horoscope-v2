export const REDIS_KEY = {
  IBC_DENOM: 'ibc_denom',
  DASHBOARD_STATISTICS: 'dashboard_statistics',
  TOP_ACCOUNTS: 'top_accounts',
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
  HANDLE_TRANSACTION: 'handle:transaction',
  HANDLE_COIN_TRANSFER: 'handle:coin_transfer',
  HANDLE_CW721_TRANSACTION: 'handle:cw721-tx',
  REFRESH_CW721_STATS: 'refresh:cw721-stats',
  CRAWL_PROPOSAL: 'crawl:proposal',
  CRAWL_TALLY_PROPOSAL: 'crawl:tally-proposal',
  COUNT_VOTE_PROPOSAL: 'handle:count-vote-proposal',
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
  HANDLE_CW20: 'handle:cw20',
  HANDLE_DASHBOARD_STATISTICS: 'handle:dashboard-statistics',
  UPDATE_FEEGRANT: 'update:feegrant',
  HANDLE_FEEGRANT: 'handle:feegrant',
  CW20_UPDATE_BY_CONTRACT: 'update:cw20-by-contract',
  CRAWL_VALIDATOR_IMG: 'crawl:validator-img',
  RETRY_CRAWL_VALIDATOR_IMG: 'retry:crawl-validator-img',
  JOB_CHECK_NEED_CREATE_EVENT_ATTR_PARTITION:
    'job:check-need-create-event-attr-partition',
  JOB_CREATE_EVENT_ATTR_PARTITION: 'job:create-event-attr-partition',
  JOB_CREATE_EVENT_PARTITION: 'job:create-event-partition',
  CRAWL_GENESIS_FEEGRANT: 'crawl:genesis-feegrant',
  CRAWL_DAILY_STATISTICS: 'crawl:daily-statistics',
  CRAWL_ACCOUNT_STATISTICS: 'crawl:account-statistics',
  HANDLE_TOP_ACCOUNTS: 'handle:top-accounts',
  HANDLE_DAILY_STATS_JOBS: 'handle:daily-stats-jobs',
  REINDEX_CW721_CONTRACT: 'reindex:cw721-contract',
  REINDEX_CW721_HISTORY: 'reindex:cw721-history',
  HANDLE_MIGRATE_CONTRACT: 'handle:migrate-contract',
  JOB_REDECODE_TX: 'job:redecode-tx',
  CRAWL_IBC_TAO: 'crawl:ibc-tao',
  CRAWL_GENESIS_IBC_TAO: 'crawl:genesis-ibc-tao',
  REINDEX_CW20_CONTRACT: 'reindex:cw20-contract',
  REINDEX_CW20_HISTORY: 'reindex:cw20-history',
  CRAWL_IBC_APP: 'crawl:ibc-app',
  CRAWL_IBC_ICS20: 'crawl:ibc-ics20',
  JOB_REASSIGN_MSG_INDEX_TO_EVENT: 'job:reassign-msg-index-to-event',
  JOB_CREATE_COMPOSITE_INDEX_ATTR_PARTITION:
    'job:create-index-composite-attr-partition',
  JOB_UPDATE_SENDER_IN_TX_MESSAGES: 'job:update-sender-in-tx-messages',
  JOB_SUMMARIZE_BRIN_INDEX_IN_TABLE: 'job:summarize-brin-index-in-table',
  JOB_CREATE_CONSTRAINT_IN_ATTR_PARTITION:
    'job:create-constraint-in-attr-partition',
  JOB_CHECK_NEED_CREATE_CONSTRAINT: 'job:check-need-create-constraint',
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
      HandleRangeBlockMissingContract: {
        key: 'HandleRangeBlockMissingContract',
        path: 'v1.Cw721Service.HandleRangeBlockMissingContract',
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
    CountVoteProposalService: {
      name: 'v1.CountVoteProposalService',
      key: 'CountVoteProposalService',
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
      TriggerHandleTxJob: {
        key: 'TriggerHandleTxJob',
        path: 'v1.CrawlTransactionService.TriggerHandleTxJob',
      },
    },
    CoinTransfer: {
      key: 'CoinTransferService',
      name: 'v1.CoinTransferService',
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
      CrawlMissingContract: {
        key: 'CrawlMissingContract',
        path: 'v1.CrawlSmartContractService.CrawlMissingContract',
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
    Cw20: {
      key: 'Cw20Service',
      name: 'v1.Cw20Service',
    },
    Cw20UpdateByContract: {
      key: 'Cw20UpdateByContract',
      name: 'v1.Cw20UpdateByContract',
      UpdateByContract: {
        key: 'UpdateByContract',
        path: 'v1.Cw20UpdateByContract.UpdateByContract',
      },
    },
    DashboardStatisticsService: {
      key: 'DashboardStatisticsService',
      name: 'v1.DashboardStatisticsService',
    },
    Feegrant: {
      HandleFeegrantHistoryService: {
        key: 'HandleFeegrantHistoryService',
        path: 'v1.Feegrant.HandleFeegrantHistoryService',
      },
      UpdateFeegrantService: {
        key: 'UpdateFeegrantService',
        path: 'v1.Feegrant.UpdateFeegrantService',
      },
    },
    CrawlValidatorImgService: {
      key: 'CrawlValidatorImageService',
    },
    CW721ReindexingService: {
      key: 'Cw721ReindexingService',
      name: 'v1.Cw721ReindexingService',
      Reindexing: {
        key: 'reindexing',
        path: 'v1.Cw721ReindexingService.reindexing',
      },
    },
    JobService: {
      CreateEventPartition: {
        key: 'CreateEventPartition',
        path: 'v1.CreateEventPartition',
      },
      CreateEventAttrPartition: {
        key: 'CreateEventAttrPartition',
        path: 'v1.CreateEventAttrPartition',
      },
      ReDecodeTx: {
        key: 'ReDecodeTx',
        path: 'v1.ReDecodeTx',
        actionCreateJob: {
          key: 'actionCreateJob',
          path: 'v1.ReDecodeTx.actionCreateJob',
        },
      },
      ReAssignMsgIndexToEvent: {
        key: 'ReAssignMsgIndexToEvent',
        path: 'v1.ReAssignMsgIndexToEvent',
      },
      CreateIndexCompositeAttrPartition: {
        key: 'CreateIndexCompositeAttrPartition',
        path: 'v1.CreateIndexCompositeAttrPartition',
        actionCreateJob: {
          key: 'actionCreateJob',
          path: 'v1.CreateIndexCompositeAttrPartition.actionCreateJob',
        },
      },
      UpdateSenderInTxMessages: {
        key: 'UpdateSenderInTxMessages',
        path: 'v1.UpdateSenderInTxMessages',
      },
      SummarizeBrinIndex: {
        key: 'SummarizeBrinIndex',
        path: 'v1.SummarizeBrinIndex',
      },
      CreateConstraintInAttrPartition: {
        key: 'CreateConstraintInAttrPartition',
        path: 'v1.CreateConstraintInAttrPartition',
      },
    },
    CrawlIBCTaoService: {
      key: 'CrawlIBCTaoService',
      name: 'v1.CrawlIBCTaoService',
    },
    CrawlIBCAppService: {
      key: 'CrawlIBCAppService',
      name: 'v1.CrawlIBCAppService',
    },
    DailyStatisticsService: {
      key: 'DailyStatisticsService',
      name: 'v1.DailyStatisticsService',
      CreateSpecificDateJob: {
        key: 'CreateSpecificDateJob',
        path: 'v1.DailyStatisticsService.CreateSpecificDateJob',
      },
    },
    AccountStatisticsService: {
      key: 'AccountStatisticsService',
      name: 'v1.AccountStatisticsService',
      CreateSpecificDateJob: {
        key: 'CreateSpecificDateJob',
        path: 'v1.AccountStatisticsService.CreateSpecificDateJob',
      },
    },
    DailyStatsJobsService: {
      key: 'DailyStatsJobsService',
      name: 'v1.DailyStatsJobsService',
    },
    Cw20ReindexingService: {
      key: 'Cw20ReindexingService',
      name: 'v1.Cw20ReindexingService',
      Reindexing: {
        key: 'reindexing',
        path: 'v1.Cw20ReindexingService.reindexing',
      },
    },
    CrawlIBCIcs20Service: {
      key: 'CrawlIBCIcs20Service',
      name: 'v1.CrawlIBCIcs20Service',
    },
    ServicesManager: {
      key: 'ServicesManager',
      name: 'v1.ServicesManager',
      HealthCheck: {
        key: 'HealthCheck',
        path: 'v1.ServicesManager.HealthCheck',
      },
    },
    HoroscopeHandlerService: {
      key: 'HoroscopeHandlerService',
      path: 'v1.HoroscopeHandlerService',
      getData: {
        key: 'getData',
        path: 'v1.HoroscopeHandlerService.getData',
      },
    },
  },
};

export enum AccountType {
  CONTINUOUS_VESTING = '/cosmos.vesting.v1beta1.ContinuousVestingAccount',
  PERIODIC_VESTING = '/cosmos.vesting.v1beta1.PeriodicVestingAccount',
  DELAYED_VESTING = '/cosmos.vesting.v1beta1.DelayedVestingAccount',
  MODULE = '/cosmos.auth.v1beta1.ModuleAccount',
  BASE = '/cosmos.auth.v1beta1.BaseAccount',
  SMART_ACCOUNT = '/auranw.aura.smartaccount.SmartAccount',
}

export enum PubkeyType {
  PUBKEY = '/cosmos.crypto.secp256k1.PubKey',
  LEGACY_AMINO_PUBKEY = '/cosmos.crypto.multisig.LegacyAminoPubKey',
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
  MSG_SUBMIT_PROPOSAL_V1: '/cosmos.gov.v1.MsgSubmitProposal',
  MSG_AUTHZ_EXEC: '/cosmos.authz.v1beta1.MsgExec',
  MSG_VOTE: '/cosmos.gov.v1beta1.MsgVote',
  MSG_VOTE_V1: '/cosmos.gov.v1.MsgVote',
  MSG_ACKNOWLEDGEMENT: '/ibc.core.channel.v1.MsgAcknowledgement',
  MSG_GRANT_ALLOWANCE: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
  MSG_FEEGRANT_GRANT: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
  MSG_FEEGRANT_REVOKE: '/cosmos.feegrant.v1beta1.MsgRevokeAllowance',
  MSG_CONSENSUS_UPDATE_PARAM: '/cosmos.consensus.v1.MsgUpdateParams',
};

export const ABCI_QUERY_PATH = {
  ACCOUNT_ALL_BALANCES: '/cosmos.bank.v1beta1.Query/AllBalances',
  ACCOUNT_SPENDABLE_BALANCES: '/cosmos.bank.v1beta1.Query/SpendableBalances',
  ACCOUNT_AUTH: '/cosmos.auth.v1beta1.Query/Account',
  DENOM_TRACE: '/ibc.applications.transfer.v1.Query/DenomTrace',
  VALIDATOR_DELEGATION: '/cosmos.staking.v1beta1.Query/Delegation',
  PROPOSAL: '/cosmos.gov.v1beta1.Query/Proposal',
  TALLY_RESULT: '/cosmos.gov.v1beta1.Query/TallyResult',
  CODE: '/cosmwasm.wasm.v1.Query/Code',
  RAW_CONTRACT_STATE: '/cosmwasm.wasm.v1.Query/RawContractState',
  CONTRACT_INFO: '/cosmwasm.wasm.v1.Query/ContractInfo',
  GET_TXS_EVENT: '/cosmos.tx.v1beta1.Service/GetTxsEvent',
};
