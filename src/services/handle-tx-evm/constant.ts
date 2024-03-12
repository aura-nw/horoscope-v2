export const EVM_CONTRACT_METHOD_HEX_PREFIX = {
  // https://ethereum.stackexchange.com/questions/124906/how-to-tell-if-a-transaction-is-contract-creation
  CREATE_CONTRACT: '60806040',
};

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
  'balanceOf(address, uint256)',
  'balanceOfBatch(address[],uint256[])',
  'setApprovalForAll(address,bool)',
  'isApprovedForAll(address,address)',
];
