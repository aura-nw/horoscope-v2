import { id as keccak256Str } from 'ethers';
import { EVMSmartContract } from '../../models';

export const ABI_CHECK_INTERFACE_ERC_721 = [
  'balanceOf(address)',
  'ownerOf(uint256)',
  'safeTransferFrom(address,address,uint256)',
  'transferFrom(address,address,uint256)',
  'approve(address,uint256)',
  'getApproved(uint256)',
  'setApprovalForAll(address,bool)',
  'isApprovedForAll(address,address)',
  'safeTransferFrom(address,address,uint256,bytes)',
];

export const ABI_CHECK_INTERFACE_ERC_20 = [
  'totalSupply()',
  'balanceOf(address)',
  'transfer(address,uint256)',
  'allowance(address,address)',
  'approve(address,uint256)',
  'transferFrom(address,address,uint256)',
];

export const ABI_CHECK_INTERFACE_ERC_1155 = [
  'safeTransferFrom(address,address,uint256,uint256,bytes)',
  'safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)',
  'balanceOf(address,uint256)',
  'balanceOfBatch(address[],uint256[])',
  'setApprovalForAll(address,bool)',
  'isApprovedForAll(address,address)',
];

export const EVM_CONTRACT_METHOD_HEX_PREFIX = {
  // https://ethereum.stackexchange.com/questions/124906/how-to-tell-if-a-transaction-is-contract-creation
  CREATE_CONTRACT: '60806040',
  ABI_INTERFACE_ERC20: ABI_CHECK_INTERFACE_ERC_20.map((method) =>
    keccak256Str(method).slice(2, 10)
  ),
  ABI_INTERFACE_ERC721: ABI_CHECK_INTERFACE_ERC_721.map((method) =>
    keccak256Str(method).slice(2, 10)
  ),
  ABI_INTERFACE_ERC1155: ABI_CHECK_INTERFACE_ERC_1155.map((method) =>
    keccak256Str(method).slice(2, 10)
  ),
};

export type DetectEVMProxyContract = {
  logicContractAddress?: string;
  EIP?: string;
};

export const EIPProxyContractSupportByteCode = {
  EIP_1967_IMPLEMENTATION: {
    SLOT: '360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc', // eip1967.proxy.implementation
    TYPE: EVMSmartContract.TYPES.PROXY_EIP_1967,
  },
  // TODO: support beacon soon.
  // EIP_1967_BEACON: {
  //   SLOT: 'a3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50', // eip1967.proxy.beacon
  //   TYPE: EVMSmartContract.TYPES.PROXY_EIP_1967,
  // },
  // EIP_1967_ADMIN: {
  //   SLOT: 'b53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103', // eip1967.proxy.admin
  //   TYPE: EVMSmartContract.TYPES.PROXY_EIP_1967,
  // },
  EIP_1822_IMPLEMENTATION: {
    SLOT: 'c5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7', // PROXIABLE
    TYPE: EVMSmartContract.TYPES.PROXY_EIP_1822,
  },
  OPEN_ZEPPELIN_IMPLEMENTATION: {
    SLOT: '7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3', // org.zeppelinos.proxy.implementation
    TYPE: EVMSmartContract.TYPES.PROXY_OPEN_ZEPPELIN_IMPLEMENTATION,
  },
};

export const NULL_BYTE_CODE =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const EVM_PREFIX = '0x';
export const EVM_DEFAULT_SLOT_BYTE_CODE_LENGTH = 66;

export const SERVICE = {
  V1: {
    HandleTransactionEVM: {
      key: 'HandleTransactionEVM',
      path: 'v1.HandleTransactionEVM',
    },
    CrawlSmartContractEVM: {
      key: 'CrawlSmartContractEVM',
      path: 'v1.CrawlSmartContractEVM',
    },
    EVMCrawlInternalTx: {
      key: 'EVMCrawlInternalTx',
      path: 'v1.EVMCrawlInternalTx',
    },
    VerifyContractEVM: {
      key: 'VerifyContractEVM',
      path: 'v1.VerifyContractEVM',
      apiCreateRequestVerify: {
        key: 'apiCreateRequest',
        path: 'v1.VerifyContractEVM.apiCreateRequest',
      },
      inputRequestVerify: {
        key: 'inputRequestVerify',
        path: 'v1.VerifyContractEVM.inputRequestVerify',
      },
    },
    Erc20: {
      key: 'Erc20',
      path: 'v1.Erc20',
    },
    Erc721: {
      key: 'Erc721',
      path: 'v1.Erc721',
    },
    SignatureMappingEVM: {
      key: 'SignatureMappingEVM',
      path: 'v1.SignatureMappingEVM',
      apiCreateRequest: {
        key: 'apiCreateSignatureMapping',
        path: 'v1.SignatureMappingEVM.apiCreateSignatureMapping',
      },
      action: {
        key: 'createJobMapping',
        path: 'v1.SignatureMappingEVM.createJobMapping',
      },
    },
    CrawlEvmProxyHistory: {
      key: 'CrawlEvmProxyHistory',
      path: 'v1.CrawlEvmProxyHistory',
    },
    JobService: {
      CrawlEvmEvent: {
        key: 'CrawlEvmEvent',
        path: 'v1.CrawlEvmEvent',
      },
      CreateEvmEventPartition: {
        key: 'CreateEvmEventPartition',
        path: 'v1.CreateEvmEventPartition',
      },
      CreateConstraintInEvmEventPartition: {
        key: 'CreateConstraintInEvmEventPartition',
        path: 'v1.CreateConstraintInEvmEventPartition',
      },
      CreateEVMTransactionPartition: {
        key: 'CreateEVMTransactionPartition',
        path: 'v1.CreateEVMTransactionPartition',
      },
      CreateConstraintInEVMTransactionPartition: {
        key: 'CreateConstraintInEVMTransactionPartition',
        path: 'v1.CreateConstraintInEVMTransactionPartition',
      },
      UpdateEvmAssets: {
        key: 'UpdateEvmAssets',
        path: 'v1.UpdateEvmAssets',
      },
    },
  },
  V2: {
    EvmProxyService: {
      key: 'EvmProxyService',
      path: 'v2.EvmProxyService',
      evmProxy: {
        key: 'evmProxy',
        path: 'v2.EvmProxyService.evmProxy',
      },
    },
  },
};

export const BULL_JOB_NAME = {
  HANDLE_TRANSACTION_EVM: 'handle:transaction-evm',
  HANDLE_EVM_SIGNATURE_MAPPING: 'handle:evm-signature-mapping',
  CRAWL_SMART_CONTRACT_EVM: 'crawl:smart-contract-evm',
  VERIFY_CONTRACT_EVM: 'verify:contract-evm',
  HANDLE_ERC20_CONTRACT: 'handle:erc20-contract',
  HANDLE_ERC20_ACTIVITY: 'handle:erc20-activity',
  HANDLE_EVM_PROXY_HISTORY: 'handle:evm-proxy-history',
  JOB_CRAWL_EVM_EVENT: 'job:crawl-evm-event',
  JOB_CREATE_EVM_TRANSACTION_PARTITION: 'job:create-evm-transaction-partition',
  JOB_CHECK_EVM_EVENT_CONSTRAINT: 'job:check-need-create-evm-event-constraint',
  JOB_CREATE_EVM_EVENT_CONSTRAINT: 'job:create-evm-event-constraint',
  JOB_CHECK_EVM_TRANSACTION_CONSTRAINT:
    'job:check-need-create-evm-transaction-constraint',
  HANDLE_ERC721_CONTRACT: 'handle:erc721-contract',
  JOB_UPDATE_EVM_ASSETS: 'job:update-evm-assets',
  JOB_CREATE_EVM_TRANSACTION_CONSTRAINT:
    'job:create-evm-transaction-constraint',
  JOB_CREATE_EVM_EVENT_PARTITION: 'job:create-evm-event-partition',
  HANDLE_ERC20_BALANCE: 'handle:erc20-balance',
  EVM_CRAWL_INTERNAL_TX: 'crawl:crawl-internal-tx',
  HANDLE_ERC721_ACTIVITY: 'handle:erc721-activity',
};

export const MSG_TYPE = {
  MSG_ETHEREUM_TX: '/ethermint.evm.v1.MsgEthereumTx',
};
