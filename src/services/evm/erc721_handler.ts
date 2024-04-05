import { decodeAbiParameters, keccak256, toHex } from 'viem';
import { Erc721Activity, EvmEvent } from '../../models';

export const ERC721_EVENT_TOPIC0 = {
  TRANSFER: keccak256(toHex('Transfer(address,address,uint256)')),
  APPROVAL: keccak256(toHex('Approval(address,address,uint256)')),
  APPROVAL_FOR_ALL: keccak256(toHex('ApprovalForAll(address,address,bool)')),
};
export const ABI_TRANSFER_PARAMS = {
  FROM: {
    name: 'from',
    type: 'address',
  },
  TO: {
    name: 'to',
    type: 'address',
  },
  TOKEN_ID: {
    name: 'tokenId',
    type: 'uint256',
  },
};
export const ABI_APPROVAL_PARAMS = {
  OWNER: {
    name: 'owner',
    type: 'address',
  },
  APPROVED: {
    name: 'approved',
    type: 'address',
  },
  TOKEN_ID: {
    name: 'tokenId',
    type: 'uint256',
  },
};
export const ERC721_ACTION = {
  TRANSFER: 'transfer',
  APPROVAL: 'approval',
  APPROVAL_FOR_ALL: 'approval_for_all',
};
export class Erc721Handler {
  static buildTransferActivity(e: EvmEvent) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [from, to, tokenId] = decodeAbiParameters(
        [
          ABI_TRANSFER_PARAMS.FROM,
          ABI_TRANSFER_PARAMS.TO,
          ABI_TRANSFER_PARAMS.TOKEN_ID,
        ],
        (e.topic1 + e.topic2.slice(2) + e.topic3.slice(2)) as `0x${string}`
      ) as [string, string, number];
      return Erc721Activity.fromJson({
        evm_event_id: e.id,
        sender: e.sender,
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: e.address,
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        height: e.block_height,
        tx_hash: e.tx_hash,
        evm_tx_id: e.evm_tx_id,
      });
    } catch {
      return undefined;
    }
  }

  static buildApprovalActivity(e: EvmEvent) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [from, to, tokenId] = decodeAbiParameters(
        [
          ABI_APPROVAL_PARAMS.OWNER,
          ABI_APPROVAL_PARAMS.APPROVED,
          ABI_APPROVAL_PARAMS.TOKEN_ID,
        ],
        (e.topic1 + e.topic2.slice(2) + e.topic3.slice(2)) as `0x${string}`
      ) as [string, string, number];
      return Erc721Activity.fromJson({
        evm_event_id: e.id,
        sender: e.sender,
        action: ERC721_ACTION.APPROVAL,
        erc721_contract_address: e.address,
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        height: e.block_height,
        tx_hash: e.tx_hash,
        evm_tx_id: e.evm_tx_id,
      });
    } catch {
      return undefined;
    }
  }

  static buildApprovalForAllActivity(e: EvmEvent) {
    try {
      const [from, to] = decodeAbiParameters(
        [ABI_APPROVAL_PARAMS.OWNER, ABI_APPROVAL_PARAMS.APPROVED],
        (e.topic1 + e.topic2.slice(2)) as `0x${string}`
      ) as [string, string];
      return Erc721Activity.fromJson({
        evm_event_id: e.id,
        sender: e.sender,
        action: ERC721_ACTION.APPROVAL_FOR_ALL,
        erc721_contract_address: e.address,
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        height: e.block_height,
        tx_hash: e.tx_hash,
        evm_tx_id: e.evm_tx_id,
      });
    } catch {
      return undefined;
    }
  }
}
