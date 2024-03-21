import { decodeAbiParameters, keccak256, toHex } from 'viem';
import { Erc20Activity, EvmEvent } from '../../models';

export const ABI_TRANSFER_PARAMS = {
  FROM: {
    name: 'from',
    type: 'address',
  },
  TO: {
    name: 'to',
    type: 'address',
  },
  VALUE: {
    name: 'value',
    type: 'uint256',
  },
};
export const ABI_APPROVAL_PARAMS = {
  OWNER: {
    name: 'owner',
    type: 'address',
  },
  SPENDER: {
    name: 'spender',
    type: 'address',
  },
  VALUE: {
    name: 'value',
    type: 'uint256',
  },
};
export const ERC20_EVENT_TOPIC0 = {
  TRANSFER: keccak256(toHex('Transfer(address,address,uint256)')),
  APPROVAL: keccak256(toHex('Approval(address,address,uint256)')),
};
export class Erc20Handler {
  static buildTransferActivity(e: EvmEvent) {
    const from = decodeAbiParameters(
      [ABI_TRANSFER_PARAMS.FROM],
      e.topic1 as `0x${string}`
    )[0];
    const to = decodeAbiParameters(
      [ABI_TRANSFER_PARAMS.TO],
      e.topic2 as `0x${string}`
    )[0];
    const amount = (
      decodeAbiParameters(
        [ABI_TRANSFER_PARAMS.VALUE],
        toHex(e.data) as `0x${string}`
      )[0] as bigint
    ).toString();
    return Erc20Activity.fromJson({
      evm_event_id: e.id,
      sender: e.sender,
      action: 'transfer',
      erc20_contract_address: e.address,
      amount,
      from,
      to,
      height: e.block_height,
      tx_hash: e.tx_hash,
    });
  }

  static buildAprovalActivity(e: EvmEvent) {
    const owner = decodeAbiParameters(
      [ABI_APPROVAL_PARAMS.OWNER],
      e.topic1 as `0x${string}`
    )[0];
    const spender = decodeAbiParameters(
      [ABI_TRANSFER_PARAMS.TO],
      e.topic2 as `0x${string}`
    )[0];
    const amount = (
      decodeAbiParameters(
        [ABI_TRANSFER_PARAMS.VALUE],
        toHex(e.data) as `0x${string}`
      )[0] as bigint
    ).toString();
    return Erc20Activity.fromJson({
      evm_event_id: e.id,
      sender: e.sender,
      action: 'aproval',
      erc20_contract_address: e.address,
      amount,
      from: owner,
      to: spender,
      height: e.block_height,
      tx_hash: e.tx_hash,
    });
  }
}
