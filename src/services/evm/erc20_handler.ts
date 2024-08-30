import { Knex } from 'knex';
import _, { Dictionary } from 'lodash';
import Moleculer from 'moleculer';
import { decodeAbiParameters, keccak256, toHex } from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';
import {
  Erc20Activity,
  Erc20Contract,
  Event,
  EventAttribute,
  EvmEvent,
  EVMTransaction,
} from '../../models';
import { AccountBalance } from '../../models/account_balance';
import { ZERO_ADDRESS } from './constant';
import { convertBech32AddressToEthAddress } from './utils';

export const ERC20_ACTION = {
  TRANSFER: 'transfer',
  APPROVAL: 'approval',
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
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
  DEPOSIT: keccak256(toHex('Deposit(address,uint256)')),
  WITHDRAWAL: keccak256(toHex('Withdrawal(address,uint256)')),
};
export class Erc20Handler {
  // key: {accountId}_{erc20ContractAddress}
  // value: accountBalance with account_id -> accountId, denom -> erc20ContractAddress
  accountBalances: Dictionary<AccountBalance>;

  erc20Activities: Erc20Activity[];

  erc20Contracts: Dictionary<Erc20Contract>;

  constructor(
    accountBalances: Dictionary<AccountBalance>,
    erc20Activities: Erc20Activity[],
    erc20Contracts: Dictionary<Erc20Contract>
  ) {
    this.accountBalances = accountBalances;
    this.erc20Activities = erc20Activities;
    this.erc20Contracts = erc20Contracts;
  }

  process() {
    this.erc20Activities.forEach((erc20Activity) => {
      if (
        [
          ERC20_ACTION.TRANSFER,
          ERC20_ACTION.DEPOSIT,
          ERC20_ACTION.WITHDRAWAL,
        ].includes(erc20Activity.action)
      ) {
        this.handlerErc20Transfer(erc20Activity);
      }
    });
  }

  handlerErc20Transfer(erc20Activity: Erc20Activity) {
    const erc20Contract: Erc20Contract =
      this.erc20Contracts[erc20Activity.erc20_contract_address];
    if (!erc20Contract) {
      throw new Error(
        `Erc20 contract not found:${erc20Activity.erc20_contract_address}`
      );
    }
    // update from account balance if from != ZERO_ADDRESS
    if (erc20Activity.from !== ZERO_ADDRESS) {
      const fromAccountId = erc20Activity.from_account_id;
      const key = `${fromAccountId}_${erc20Activity.erc20_contract_address}`;
      const fromAccountBalance = this.accountBalances[key];
      if (
        fromAccountBalance &&
        erc20Activity.height < fromAccountBalance.last_updated_height
      ) {
        throw new Error(
          `Process erc20 balance: fromAccountBalance ${erc20Activity.from} was updated`
        );
      }
      // calculate new balance: decrease balance of from account
      const amount = (
        BigInt(fromAccountBalance?.amount || 0) - BigInt(erc20Activity.amount)
      ).toString();
      // update object accountBalance
      this.accountBalances[key] = AccountBalance.fromJson({
        denom: erc20Activity.erc20_contract_address,
        amount,
        last_updated_height: erc20Activity.height,
        account_id: fromAccountId,
        type: AccountBalance.TYPE.ERC20_TOKEN,
      });
    } else if (erc20Contract.total_supply !== null) {
      // update total supply
      erc20Contract.total_supply = (
        BigInt(erc20Contract.total_supply) + BigInt(erc20Activity.amount)
      ).toString();
      // update last updated height
      erc20Contract.last_updated_height = erc20Activity.height;
    }
    // update from account balance if to != ZERO_ADDRESS
    if (erc20Activity.to !== ZERO_ADDRESS) {
      // update to account balance
      const toAccountId = erc20Activity.to_account_id;
      const key = `${toAccountId}_${erc20Activity.erc20_contract_address}`;
      const toAccountBalance = this.accountBalances[key];
      if (
        toAccountBalance &&
        erc20Activity.height < toAccountBalance.last_updated_height
      ) {
        throw new Error(
          `Process erc20 balance: toAccountBalance ${erc20Activity.to} was updated`
        );
      }
      // calculate new balance: increase balance of to account
      const amount = (
        BigInt(toAccountBalance?.amount || 0) + BigInt(erc20Activity.amount)
      ).toString();
      // update object accountBalance
      this.accountBalances[key] = AccountBalance.fromJson({
        denom: erc20Activity.erc20_contract_address,
        amount,
        last_updated_height: erc20Activity.height,
        account_id: toAccountId,
        type: AccountBalance.TYPE.ERC20_TOKEN,
      });
    } else if (erc20Contract.total_supply !== null) {
      // update total supply
      erc20Contract.total_supply = (
        BigInt(erc20Contract.total_supply) - BigInt(erc20Activity.amount)
      ).toString();
      // update last updated height
      erc20Contract.last_updated_height = erc20Activity.height;
    }
  }

  static async buildErc20Activities(
    startBlock: number,
    endBlock: number,
    trx: Knex.Transaction,
    logger: Moleculer.LoggerInstance,
    addresses?: string[],
    page?: {
      prevEvmEventId?: number;
      limitRecordGet: number;
      prevCosmosEventId?: number;
    }
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
    const erc20Activities: Erc20Activity[] = [];
    const erc20Events = await EvmEvent.query()
      .transacting(trx)
      .joinRelated('[evm_smart_contract,evm_transaction]')
      .innerJoin(
        'erc20_contract',
        'evm_event.address',
        'erc20_contract.address'
      )
      .modify((builder) => {
        if (addresses) {
          builder.whereIn('evm_event.address', addresses);
        }
        if (page && page.prevEvmEventId !== undefined) {
          builder
            .andWhere('evm_event.id', '>', page.prevEvmEventId)
            .limit(page.limitRecordGet);
        }
      })
      .where('evm_event.evm_tx_id', '>=', fromTx.id)
      .andWhere('evm_event.evm_tx_id', '<=', toTx.id)
      .orderBy('evm_event.id', 'asc')
      .select(
        'evm_event.*',
        'evm_transaction.from as sender',
        'evm_smart_contract.id as evm_smart_contract_id',
        'evm_transaction.id as evm_tx_id'
      );
    let erc20CosmosEvents: Event[] = [];
    if (config.evmOnly === false) {
      erc20CosmosEvents = await Event.query()
        .transacting(trx)
        .where('event.block_height', '>', startBlock)
        .andWhere('event.block_height', '<=', endBlock)
        .andWhere((query) => {
          query
            .where('event.type', Event.EVENT_TYPE.CONVERT_COIN)
            .orWhere('event.type', Event.EVENT_TYPE.CONVERT_ERC20);
        })
        .modify((builder) => {
          if (addresses) {
            builder
              .joinRelated('attributes')
              .where('attributes.key', EventAttribute.ATTRIBUTE_KEY.ERC20_TOKEN)
              .whereIn(knex.raw('lower("value")'), addresses);
          }
          if (page && page.prevCosmosEventId !== undefined) {
            builder
              .andWhere('event.id', '>', page.prevCosmosEventId)
              .limit(page.limitRecordGet);
          }
        })
        .withGraphFetched('[transaction, attributes]')
        .orderBy('event.id', 'asc');
    }
    erc20Events.forEach((e) => {
      if (e.topic0 === ERC20_EVENT_TOPIC0.TRANSFER) {
        const activity = Erc20Handler.buildTransferActivity(e, logger);
        if (activity) {
          erc20Activities.push(activity);
        }
      } else if (e.topic0 === ERC20_EVENT_TOPIC0.APPROVAL) {
        const activity = Erc20Handler.buildApprovalActivity(e, logger);
        if (activity) {
          erc20Activities.push(activity);
        }
      } else if (config.erc20.wrapExtensionContract.includes(e.address)) {
        const wrapActivity = Erc20Handler.buildWrapExtensionActivity(e, logger);
        if (wrapActivity) {
          erc20Activities.push(wrapActivity);
        }
      }
    });
    erc20CosmosEvents.forEach((event) => {
      const activity = Erc20Handler.buildTransferActivityByCosmos(
        event,
        logger
      );
      if (activity) {
        erc20Activities.push(activity);
      }
    });
    return {
      erc20Activities: _.sortBy(erc20Activities, 'cosmos_tx_id'),
      prevEvmEventId: erc20Events[erc20Events.length - 1]?.id,
      prevCosmosEventId: erc20CosmosEvents[erc20CosmosEvents.length - 1]?.id,
    };
  }

  static async getErc20Activities(
    startBlock: number,
    endBlock: number,
    trx?: Knex.Transaction,
    addresses?: string[],
    page?: { prevId: number; limitRecordGet: number }
  ): Promise<Erc20Activity[]> {
    return Erc20Activity.query()
      .modify((builder) => {
        if (addresses) {
          builder.whereIn('erc20_contract.address', addresses);
        }
        if (trx) {
          builder.transacting(trx);
        }
        if (page) {
          builder
            .andWhere('erc20_activity.id', '>', page.prevId)
            .limit(page.limitRecordGet);
        }
      })
      .leftJoin(
        'account as from_account',
        'erc20_activity.from',
        'from_account.evm_address'
      )
      .leftJoin(
        'account as to_account',
        'erc20_activity.to',
        'to_account.evm_address'
      )
      .leftJoin(
        'erc20_contract as erc20_contract',
        'erc20_activity.erc20_contract_address',
        'erc20_contract.address'
      )
      .where('erc20_activity.height', '>', startBlock)
      .andWhere('erc20_activity.height', '<=', endBlock)
      .andWhere('erc20_contract.track', true)
      .select(
        'erc20_activity.*',
        'from_account.id as from_account_id',
        'to_account.id as to_account_id'
      )
      .orderBy('erc20_activity.id');
  }

  static async updateErc20AccountsBalance(
    erc20Activities: Erc20Activity[],
    trx: Knex.Transaction
  ) {
    if (erc20Activities.length > 0) {
      const accountBalances = _.keyBy(
        await AccountBalance.query()
          .transacting(trx)
          .joinRelated('account')
          .whereIn(
            ['account.evm_address', 'denom'],
            [
              ...erc20Activities.map((e) => [e.from, e.erc20_contract_address]),
              ...erc20Activities.map((e) => [e.to, e.erc20_contract_address]),
            ]
          ),
        (o) => `${o.account_id}_${o.denom}`
      );
      const erc20Contracts = _.keyBy(
        await Erc20Contract.query()
          .transacting(trx)
          .whereIn(
            'address',
            erc20Activities.map((e) => e.erc20_contract_address)
          ),
        'address'
      );
      // construct cw721 handler object
      const erc20Handler = new Erc20Handler(
        accountBalances,
        erc20Activities,
        erc20Contracts
      );
      erc20Handler.process();
      const updatedErc20Contracts = Object.values(erc20Handler.erc20Contracts);
      if (updatedErc20Contracts.length > 0) {
        await Erc20Contract.query()
          .transacting(trx)
          .insert(updatedErc20Contracts)
          .onConflict(['id'])
          .merge();
      }
      const updatedAccountBalances = Object.values(
        erc20Handler.accountBalances
      );
      if (updatedAccountBalances.length > 0) {
        await AccountBalance.query()
          .transacting(trx)
          .insert(updatedAccountBalances)
          .onConflict(['account_id', 'denom'])
          .merge();
      }
    }
  }

  static buildTransferActivity(
    e: EvmEvent,
    logger: Moleculer.LoggerInstance
  ): Erc20Activity | undefined {
    try {
      const amountEncoded = e.data ? toHex(e.data) : e.topic3;
      const [from, to, amount] = decodeAbiParameters(
        [
          ABI_TRANSFER_PARAMS.FROM,
          ABI_TRANSFER_PARAMS.TO,
          ABI_TRANSFER_PARAMS.VALUE,
        ],
        (e.topic1 + e.topic2.slice(2) + amountEncoded.slice(2)) as `0x${string}`
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
        evm_tx_id: e.evm_tx_id,
        cosmos_tx_id: e.tx_id,
      });
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }

  static buildTransferActivityByCosmos(
    e: Event,
    logger: Moleculer.LoggerInstance
  ): Erc20Activity | undefined {
    try {
      const getAddressFromAttrAndConvert0x = (
        attrs: EventAttribute[],
        key: string
      ) => {
        const attr = attrs.find((attr) => attr.key === key);
        if (attr) {
          let { value } = attr;
          if (!value.startsWith('0x')) {
            value = convertBech32AddressToEthAddress(
              config.networkPrefixAddress,
              value
            );
          }
          return value.toLowerCase();
        }
        return undefined;
      };

      let from = getAddressFromAttrAndConvert0x(
        e.attributes,
        EventAttribute.ATTRIBUTE_KEY.SENDER
      );
      let to = getAddressFromAttrAndConvert0x(
        e.attributes,
        EventAttribute.ATTRIBUTE_KEY.RECEIVER
      );
      const sender = from;
      if (e.type === Event.EVENT_TYPE.CONVERT_COIN) {
        from = ZERO_ADDRESS;
      } else if (e.type === Event.EVENT_TYPE.CONVERT_ERC20) {
        to = ZERO_ADDRESS;
      }
      const amount = e.attributes.find(
        (attr) => attr.key === EventAttribute.ATTRIBUTE_KEY.AMOUNT
      );
      const address = getAddressFromAttrAndConvert0x(
        e.attributes,
        EventAttribute.ATTRIBUTE_KEY.ERC20_TOKEN
      );
      return Erc20Activity.fromJson({
        sender,
        action: ERC20_ACTION.TRANSFER,
        erc20_contract_address: address,
        amount: amount?.value,
        from,
        to,
        height: e.block_height,
        tx_hash: e.transaction.hash,
        cosmos_event_id: e.id,
        cosmos_tx_id: e.tx_id,
      });
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }

  static buildApprovalActivity(
    e: EvmEvent,
    logger: Moleculer.LoggerInstance
  ): Erc20Activity | undefined {
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
        evm_tx_id: e.evm_tx_id,
        cosmos_tx_id: e.tx_id,
      });
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }

  static buildWrapExtensionActivity(
    e: EvmEvent,
    logger: Moleculer.LoggerInstance
  ): Erc20Activity | undefined {
    if (e.topic0 === ERC20_EVENT_TOPIC0.DEPOSIT) {
      const activity = Erc20Handler.buildWrapDepositActivity(e, logger);
      return activity;
    }
    if (e.topic0 === ERC20_EVENT_TOPIC0.WITHDRAWAL) {
      const activity = Erc20Handler.buildWrapWithdrawalActivity(e, logger);
      return activity;
    }
    return undefined;
  }

  private static buildWrapDepositActivity(
    e: EvmEvent,
    logger: Moleculer.LoggerInstance
  ): Erc20Activity | undefined {
    try {
      const [to, amount] = decodeAbiParameters(
        [ABI_TRANSFER_PARAMS.TO, ABI_APPROVAL_PARAMS.VALUE],
        (e.topic1 + toHex(e.data).slice(2)) as `0x${string}`
      ) as [string, bigint];
      return Erc20Activity.fromJson({
        evm_event_id: e.id,
        sender: e.sender,
        action: ERC20_ACTION.DEPOSIT,
        erc20_contract_address: e.address,
        amount: amount.toString(),
        from: ZERO_ADDRESS,
        to: to.toLowerCase(),
        height: e.block_height,
        tx_hash: e.tx_hash,
        evm_tx_id: e.evm_tx_id,
        cosmos_tx_id: e.tx_id,
      });
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }

  private static buildWrapWithdrawalActivity(
    e: EvmEvent,
    logger: Moleculer.LoggerInstance
  ): Erc20Activity | undefined {
    try {
      const [from, amount] = decodeAbiParameters(
        [ABI_TRANSFER_PARAMS.FROM, ABI_APPROVAL_PARAMS.VALUE],
        (e.topic1 + toHex(e.data).slice(2)) as `0x${string}`
      ) as [string, bigint];
      return Erc20Activity.fromJson({
        evm_event_id: e.id,
        sender: e.sender,
        action: ERC20_ACTION.WITHDRAWAL,
        erc20_contract_address: e.address,
        amount: amount.toString(),
        from: from.toLowerCase(),
        to: ZERO_ADDRESS,
        height: e.block_height,
        tx_hash: e.tx_hash,
        evm_tx_id: e.evm_tx_id,
        cosmos_tx_id: e.tx_id,
      });
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }
}
