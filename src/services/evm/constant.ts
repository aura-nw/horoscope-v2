import { id as keccak256Str } from 'ethers';

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

export enum EIPProxyContractSupportByteCode {
  EIP_1967_LOGIC_SLOT = '360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc', // eip1967.proxy.implementation
  EIP_1967_BEACON_SLOT = 'a3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50', // eip1967.proxy.beacon
  EIP_1822_LOGIC_SLOT = 'c5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7', // PROXIABLE
  OPEN_ZEPPELIN_IMPLEMENTATION_SLOT = '7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3', // org.zeppelinos.proxy.implementation
}

export const NULL_BYTE_CODE =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const EVM_PREFIX = '0x';
export const EVM_DEFAULT_SLOT_BYTE_CODE_LENGTH = 66;
