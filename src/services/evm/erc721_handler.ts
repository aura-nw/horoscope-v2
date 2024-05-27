import { Dictionary } from 'lodash';
import Moleculer from 'moleculer';
import { decodeAbiParameters, keccak256, toHex } from 'viem';
import { Knex } from 'knex';
import { Erc721Activity, Erc721Token, EvmEvent } from '../../models';
import { ZERO_ADDRESS } from './constant';

export const ERC721_EVENT_TOPIC0 = {
  TRANSFER: keccak256(toHex('Transfer(address,address,uint256)')),
  APPROVAL: keccak256(toHex('Approval(address,address,uint256)')),
  APPROVAL_FOR_ALL: keccak256(toHex('ApprovalForAll(address,address,bool)')),
};
export const ABI_TRANSFER_PARAMS = [
  {
    name: 'from',
    type: 'address',
  },
  {
    name: 'to',
    type: 'address',
  },
  {
    name: 'tokenId',
    type: 'uint256',
  },
];
export const ABI_APPROVAL_PARAMS = [
  {
    name: 'owner',
    type: 'address',
  },
  {
    name: 'approved',
    type: 'address',
  },
  {
    name: 'tokenId',
    type: 'uint256',
  },
];
export const ABI_APPROVAL_ALL_PARAMS = [
  {
    name: 'owner',
    type: 'address',
  },
  {
    name: 'approved',
    type: 'address',
  },
];
export const ERC721_ACTION = {
  TRANSFER: 'transfer',
  APPROVAL: 'approval',
  APPROVAL_FOR_ALL: 'approval_for_all',
};
export class Erc721Handler {
  // key: {contract_address}_{token_id}
  // value: erc721 token
  erc721Tokens: Dictionary<Erc721Token>;

  erc721Activities: Erc721Activity[];

  constructor(
    erc721Tokens: Dictionary<Erc721Token>,
    erc721Activities: Erc721Activity[]
  ) {
    this.erc721Tokens = erc721Tokens;
    this.erc721Activities = erc721Activities;
  }

  process() {
    this.erc721Activities.forEach((erc721Activity) => {
      if (erc721Activity.action === ERC721_ACTION.TRANSFER) {
        this.handlerErc721Transfer(erc721Activity);
      }
    });
  }

  handlerErc721Transfer(erc721Activity: Erc721Activity) {
    const token =
      this.erc721Tokens[
        `${erc721Activity.erc721_contract_address}_${erc721Activity.token_id}`
      ];
    if (token) {
      // update new owner and last updated height
      token.owner = erc721Activity.to;
      token.last_updated_height = erc721Activity.height;
    } else if (erc721Activity.from === ZERO_ADDRESS) {
      // handle mint
      this.erc721Tokens[
        `${erc721Activity.erc721_contract_address}_${erc721Activity.token_id}`
      ] = Erc721Token.fromJson({
        token_id: erc721Activity.token_id,
        owner: erc721Activity.to,
        erc721_contract_address: erc721Activity.erc721_contract_address,
        last_updated_height: erc721Activity.height,
        burned: false,
      });
    } else {
      throw new Error('Handle erc721 tranfer error');
    }
  }

  static buildTransferActivity(
    e: EvmEvent,
    logger: Moleculer.LoggerInstance
  ): Erc721Activity | undefined {
    try {
      const [from, to, tokenId] = decodeAbiParameters(
        ABI_TRANSFER_PARAMS,
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
        token_id: tokenId.toString(),
      });
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }

  static buildApprovalActivity(
    e: EvmEvent,
    logger: Moleculer.LoggerInstance
  ): Erc721Activity | undefined {
    try {
      const [from, to, tokenId] = decodeAbiParameters(
        ABI_APPROVAL_PARAMS,
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
        token_id: tokenId.toString(),
      });
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }

  static buildApprovalForAllActivity(
    e: EvmEvent,
    logger: Moleculer.LoggerInstance
  ): Erc721Activity | undefined {
    try {
      const [from, to] = decodeAbiParameters(
        ABI_APPROVAL_ALL_PARAMS,
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
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }

  static async getErc721Activities(
    startBlock: number,
    endBlock: number,
    trx: Knex.Transaction,
    logger: Moleculer.LoggerInstance
  ) {
    const erc721Events = await EvmEvent.query()
      .transacting(trx)
      .joinRelated('[evm_smart_contract,evm_transaction]')
      .innerJoin(
        'erc721_contract',
        'evm_event.address',
        'erc721_contract.address'
      )
      .where('evm_event.block_height', '>', startBlock)
      .andWhere('evm_event.block_height', '<=', endBlock)
      .orderBy('evm_event.id', 'asc')
      .select(
        'evm_event.*',
        'evm_transaction.from as sender',
        'evm_smart_contract.id as evm_smart_contract_id',
        'evm_transaction.id as evm_tx_id',
        'erc721_contract.track as track'
      );
    const erc721Activities: Erc721Activity[] = [];
    erc721Events
      .filter((e) => e.track)
      .forEach((e) => {
        if (e.topic0 === ERC721_EVENT_TOPIC0.TRANSFER) {
          const activity = Erc721Handler.buildTransferActivity(e, logger);
          if (activity) {
            erc721Activities.push(activity);
          }
        } else if (e.topic0 === ERC721_EVENT_TOPIC0.APPROVAL) {
          const activity = Erc721Handler.buildApprovalActivity(e, logger);
          if (activity) {
            erc721Activities.push(activity);
          }
        } else if (e.topic0 === ERC721_EVENT_TOPIC0.APPROVAL_FOR_ALL) {
          const activity = Erc721Handler.buildApprovalForAllActivity(e, logger);
          if (activity) {
            erc721Activities.push(activity);
          }
        }
      });
    return erc721Activities;
  }
}
