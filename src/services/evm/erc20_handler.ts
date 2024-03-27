import { decodeAbiParameters, keccak256, toHex } from 'viem';
import { Dictionary } from 'lodash';
import { Erc20Activity, EvmEvent } from '../../models';
import { AccountBalance } from '../../models/account_balance';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ERC20_ACTION = {
  TRANSFER: 'transfer',
  APPROVAL: 'approval',
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
  // key: {accountId}_{erc20ContractAddress}
  // value: accountBalance with account_id -> accountId, denom -> erc20ContractAddress
  holdersKeyBy: Dictionary<AccountBalance>;

  erc20Activities: Erc20Activity[];

  constructor(
    holdersKeyBy: Dictionary<AccountBalance>,
    erc20Activities: Erc20Activity[]
  ) {
    this.holdersKeyBy = holdersKeyBy;
    this.erc20Activities = erc20Activities;
  }

  process() {
    this.erc20Activities.forEach((erc20Activity) => {
      if (erc20Activity.action === ERC20_ACTION.TRANSFER) {
        console.log('abc');
      }
    });
  }

  static buildTransferActivity(e: EvmEvent) {
    try {
      const [from, to, amount] = decodeAbiParameters(
        [
          ABI_TRANSFER_PARAMS.FROM,
          ABI_TRANSFER_PARAMS.TO,
          ABI_TRANSFER_PARAMS.VALUE,
        ],
        (e.topic1 + e.topic2.slice(2) + toHex(e.data).slice(2)) as `0x${string}`
      ) as [string, string, bigint];
      return Erc20Activity.fromJson({
        evm_event_id: e.id,
        sender: e.sender,
        action: ERC20_ACTION.TRANSFER,
        erc20_contract_address: e.address,
        amount: amount.toString(),
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        height: e.block_height,
        tx_hash: e.tx_hash,
      });
    } catch {
      return undefined;
    }
  }

  static buildApprovalActivity(e: EvmEvent) {
    try {
      const [from, to, amount] = decodeAbiParameters(
        [
          ABI_APPROVAL_PARAMS.OWNER,
          ABI_APPROVAL_PARAMS.SPENDER,
          ABI_APPROVAL_PARAMS.VALUE,
        ],
        (e.topic1 + e.topic2.slice(2) + toHex(e.data).slice(2)) as `0x${string}`
      ) as [string, string, bigint];
      return Erc20Activity.fromJson({
        evm_event_id: e.id,
        sender: e.sender,
        action: ERC20_ACTION.APPROVAL,
        erc20_contract_address: e.address,
        amount: amount.toString(),
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        height: e.block_height,
        tx_hash: e.tx_hash,
      });
    } catch {
      return undefined;
    }
  }
}
