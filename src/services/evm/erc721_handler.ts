import { Knex } from 'knex';
import _, { Dictionary } from 'lodash';
import Moleculer from 'moleculer';
import { bytesToHex, decodeAbiParameters, keccak256, toHex } from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';
import {
  Block,
  EVMBlock,
  EVMTransaction,
  Erc721Activity,
  Erc721Contract,
  Erc721HolderStatistic,
  Erc721Token,
  EvmEvent,
} from '../../models';
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
  erc721Contracts: Dictionary<Erc721Contract>;

  // key: {contract_address}_{token_id}
  // value: erc721 token
  erc721Tokens: Dictionary<Erc721Token>;

  erc721Activities: Erc721Activity[];

  erc721HolderStats: Dictionary<Erc721HolderStatistic>;

  constructor(
    erc721Contracts: Dictionary<Erc721Contract>,
    erc721Tokens: Dictionary<Erc721Token>,
    erc721Activities: Erc721Activity[],
    erc721HolderStats: Dictionary<Erc721HolderStatistic>
  ) {
    this.erc721Contracts = erc721Contracts;
    this.erc721Tokens = erc721Tokens;
    this.erc721Activities = erc721Activities;
    this.erc721HolderStats = erc721HolderStats;
  }

  process() {
    this.erc721Activities.forEach((erc721Activity) => {
      if (erc721Activity.action === ERC721_ACTION.TRANSFER) {
        this.handlerErc721Transfer(erc721Activity);
      }
      this.erc721Contracts[
        erc721Activity.erc721_contract_address
      ].total_actions[erc721Activity.action] =
        (this.erc721Contracts[erc721Activity.erc721_contract_address]
          .total_actions[erc721Activity.action] || 0) + 1;
    });
  }

  handlerErc721Transfer(erc721Activity: Erc721Activity) {
    const erc721Contract =
      this.erc721Contracts[`${erc721Activity.erc721_contract_address}`];
    const token =
      this.erc721Tokens[
        `${erc721Activity.erc721_contract_address}_${erc721Activity.token_id}`
      ];
    if (token) {
      // update new owner and last updated height
      token.owner = erc721Activity.to;
      token.last_updated_height = erc721Activity.height;
      if (erc721Activity.to === ZERO_ADDRESS) {
        erc721Contract.total_supply = (
          BigInt(erc721Contract.total_supply) - BigInt(1)
        ).toString();
      }
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
      erc721Contract.total_supply = (
        BigInt(erc721Contract.total_supply) + BigInt(1)
      ).toString();
    } else {
      throw new Error(`Handle erc721 tranfer error, address: ${erc721Contract.address}`);
    }
    // update erc721 holder statistics
    const erc721HolderStatFrom =
      this.erc721HolderStats[
        `${erc721Activity.erc721_contract_address}_${erc721Activity.from}`
      ];
    this.erc721HolderStats[
      `${erc721Activity.erc721_contract_address}_${erc721Activity.from}`
    ] = Erc721HolderStatistic.fromJson({
      erc721_contract_address: erc721Activity.erc721_contract_address,
      owner: erc721Activity.from,
      count: (BigInt(erc721HolderStatFrom?.count || 0) - BigInt(1)).toString(),
      last_updated_height: erc721Activity.height,
    });
    const erc721HolderStatTo =
      this.erc721HolderStats[
        `${erc721Activity.erc721_contract_address}_${erc721Activity.to}`
      ];
    this.erc721HolderStats[
      `${erc721Activity.erc721_contract_address}_${erc721Activity.to}`
    ] = Erc721HolderStatistic.fromJson({
      erc721_contract_address: erc721Activity.erc721_contract_address,
      owner: erc721Activity.to,
      count: (BigInt(erc721HolderStatTo?.count || 0) + BigInt(1)).toString(),
      last_updated_height: erc721Activity.height,
    });
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
        sender: bytesToHex(e.sender),
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
        sender: bytesToHex(e.sender),
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
        sender: bytesToHex(e.sender),
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
    logger: Moleculer.LoggerInstance,
    addresses?: string[],
    trx?: Knex.Transaction
  ) {
    const [fromTx, toTx] = await Promise.all([
      EVMTransaction.query()
        .select('id')
        .findOne('height', '>', startBlock)
        .orderBy('height', 'asc')
        .orderBy('index', 'asc')
        .limit(1),
      EVMTransaction.query()
        .select('id')
        .findOne('height', '<=', endBlock)
        .orderBy('height', 'desc')
        .orderBy('index', 'desc')
        .limit(1),
    ]);
    if (!fromTx || !toTx) {
      throw Error('fromTx or toTx cannot be found');
    }

    const erc721Events = await EvmEvent.query()
      .joinRelated('[evm_smart_contract,evm_transaction]')
      .innerJoin(
        'erc721_contract',
        'evm_event.address',
        'erc721_contract.address'
      )
      .modify((builder) => {
        if (addresses) {
          builder.whereIn('evm_event.address', addresses);
        }
        if (trx) {
          builder.transacting(trx);
        }
      })
      .where('evm_event.evm_tx_id', '>=', fromTx.id)
      .andWhere('evm_event.evm_tx_id', '<=', toTx.id)
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

  static async updateErc721(
    erc721Contracts: Erc721Contract[],
    erc721Activities: Erc721Activity[],
    erc721Tokens: Erc721Token[],
    erc721HolderStats: Erc721HolderStatistic[],
    trx: Knex.Transaction
  ) {
    // update erc721 contract: total supply
    if (erc721Contracts.length > 0) {
      const stringListUpdates = erc721Contracts
        .map(
          (erc721Contract) =>
            `(${erc721Contract.id}, ${
              erc721Contract.total_supply
            }, '${JSON.stringify(erc721Contract.total_actions ?? {})}'::jsonb)`
        )
        .join(',');
      await knex
        .raw(
          `UPDATE erc721_contract SET total_supply = temp.total_supply, total_actions = temp.total_actions from (VALUES ${stringListUpdates}) as temp(id, total_supply, total_actions) where temp.id = erc721_contract.id`
        )
        .transacting(trx);
    }
    let updatedTokens: Dictionary<Erc721Token> = {};
    // update erc721 token: new token & new holder
    if (erc721Tokens.length > 0) {
      updatedTokens = _.keyBy(
        await Erc721Token.query()
          .insert(
            erc721Tokens.map((token) =>
              Erc721Token.fromJson({
                token_id: token.token_id,
                owner: token.owner,
                erc721_contract_address: token.erc721_contract_address,
                last_updated_height: token.last_updated_height,
              })
            )
          )
          .onConflict(['token_id', 'erc721_contract_address'])
          .merge()
          .transacting(trx),
        (o) => `${o.erc721_contract_address}_${o.token_id}`
      );
    }
    // insert new erc721 activities
    if (erc721Activities.length > 0) {
      erc721Activities.forEach((activity) => {
        const token =
          updatedTokens[
            `${activity.erc721_contract_address}_${activity.token_id}`
          ];
        if (token) {
          // eslint-disable-next-line no-param-reassign
          activity.erc721_token_id = token.id;
        }
      });
      await knex
        .batchInsert(
          'erc721_activity',
          erc721Activities.map((e) => _.omit(e, 'token_id')),
          config.erc721.chunkSizeInsert
        )
        .transacting(trx);
    }
    // update erc721 holder statistic
    if (erc721HolderStats.length > 0) {
      await Erc721HolderStatistic.query()
        .transacting(trx)
        .insert(
          erc721HolderStats.map((e) =>
            Erc721HolderStatistic.fromJson({
              erc721_contract_address: e.erc721_contract_address,
              owner: e.owner,
              count: e.count,
              last_updated_height: e.last_updated_height,
            })
          )
        )
        .onConflict(['erc721_contract_address', 'owner'])
        .merge();
    }
  }

  static async calErc721Stats(addresses?: string[]): Promise<Erc721Contract[]> {
    // Get once block height 24h ago.
    let blockSince24hAgo: any = [];
    if (!config.evmOnly) {
      blockSince24hAgo = await Block.query()
        .select('height')
        .where('time', '<=', knex.raw("now() - '24 hours'::interval"))
        .orderBy('height', 'desc')
        .limit(1);
    } else {
      blockSince24hAgo = await EVMBlock.query()
        .select('height')
        .where('timestamp', '<=', knex.raw("now() - '24 hours'::interval"))
        .orderBy('height', 'desc')
        .limit(1);
    }
    // Calculate total activity and transfer_24h of erc721
    // not return record if erc721 contract haven't erc721 activities
    return Erc721Contract.query()
      .count('erc721_activity.id AS total_activity')
      .select(
        knex.raw(
          `SUM( CASE WHEN erc721_activity.height >= ? AND erc721_activity.action = '${ERC721_ACTION.TRANSFER}' THEN 1 ELSE 0 END ) AS transfer_24h`,
          blockSince24hAgo[0]?.height
        )
      )
      .select('erc721_contract.id as erc721_contract_id')
      .where('erc721_contract.track', '=', true)
      .modify((builder) => {
        if (addresses) {
          builder.whereIn('erc721_contract.address', addresses);
        }
      })
      .joinRelated('erc721_activity')
      .groupBy('erc721_contract.id');
  }
}
