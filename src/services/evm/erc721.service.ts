import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Knex } from 'knex';
import _, { Dictionary } from 'lodash';
import { ServiceBroker } from 'moleculer';
import { getContract } from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import '../../../fetch-polyfill.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import knex from '../../common/utils/db_connection';
import EtherJsClient from '../../common/utils/etherjs_client';
import {
  BlockCheckpoint,
  EVMSmartContract,
  Erc721Activity,
  EvmEvent,
} from '../../models';
import { Erc721Contract } from '../../models/erc721_contract';
import { Erc721Token } from '../../models/erc721_token';
import { BULL_JOB_NAME, SERVICE } from './constant';
import { ERC721_EVENT_TOPIC0, Erc721Handler } from './erc721_handler';

@Service({
  name: SERVICE.V1.Erc721.key,
  version: 1,
})
export default class Erc721Service extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
    jobName: BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
  })
  async handleErc721Contract(): Promise<void> {
    await knex.transaction(async (trx) => {
      // get id evm smart contract checkpoint
      // get range blocks for proccessing
      const [startBlock, endBlock, updateBlockCheckpoint] =
        await BlockCheckpoint.getCheckpoint(
          BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
          [BULL_JOB_NAME.CRAWL_SMART_CONTRACT_EVM],
          config.erc721.key
        );
      const erc721SmartContracts = await EVMSmartContract.query()
        .where('created_height', '>', startBlock)
        .andWhere('created_height', '<=', endBlock)
        .andWhere('type', EVMSmartContract.TYPES.ERC721)
        .orderBy('id', 'asc');
      if (erc721SmartContracts.length > 0) {
        const erc721Instances = await this.getErc721Instances(
          erc721SmartContracts
        );
        await Erc721Contract.query().transacting(trx).insert(erc721Instances);
      }
      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ERC721_ACTIVITY,
    jobName: BULL_JOB_NAME.HANDLE_ERC721_ACTIVITY,
  })
  async handleErc721Activity(): Promise<void> {
    await knex.transaction(async (trx) => {
      const [startBlock, endBlock, updateBlockCheckpoint] =
        await BlockCheckpoint.getCheckpoint(
          BULL_JOB_NAME.HANDLE_ERC721_ACTIVITY,
          [BULL_JOB_NAME.HANDLE_ERC721_CONTRACT],
          config.erc721.key
        );
      // TODO: handle track er721 contract only
      const erc721Events = await EvmEvent.query()
        .transacting(trx)
        .joinRelated('[evm_smart_contract,evm_transaction]')
        .where('evm_event.block_height', '>', startBlock)
        .andWhere('evm_event.block_height', '<=', endBlock)
        .andWhere('evm_smart_contract.type', EVMSmartContract.TYPES.ERC721)
        .orderBy('evm_event.id', 'asc')
        .select(
          'evm_event.*',
          'evm_transaction.from as sender',
          'evm_smart_contract.id as evm_smart_contract_id',
          'evm_transaction.id as evm_tx_id'
        );
      await this.handleMissingErc721Contract(erc721Events, trx);
      const erc721Activities: Erc721Activity[] = [];
      erc721Events.forEach((e) => {
        if (e.topic0 === ERC721_EVENT_TOPIC0.TRANSFER) {
          const activity = Erc721Handler.buildTransferActivity(e);
          if (activity) {
            erc721Activities.push(activity);
          }
        } else if (e.topic0 === ERC721_EVENT_TOPIC0.APPROVAL) {
          const activity = Erc721Handler.buildApprovalActivity(e);
          if (activity) {
            erc721Activities.push(activity);
          }
        } else if (e.topic0 === ERC721_EVENT_TOPIC0.APPROVAL_FOR_ALL) {
          const activity = Erc721Handler.buildApprovalForAllActivity(e);
          if (activity) {
            erc721Activities.push(activity);
          }
        }
      });
      if (erc721Activities.length > 0) {
        const erc721Contracts = _.keyBy(
          await Erc721Contract.query()
            .whereIn(
              'address',
              erc721Activities.map((e) => e.erc721_contract_address)
            )
            .transacting(trx),
          'address'
        );
        const erc721Tokens = _.keyBy(
          await Erc721Token.query()
            .whereIn(
              ['erc721_contract_address', 'token_id'],
              erc721Activities.map((e) => [
                e.erc721_contract_address,
                e.token_id,
              ])
            )
            .transacting(trx),
          (o) => `${o.erc721_contract_address}_${o.token_id}`
        );
        const erc721Handler = new Erc721Handler(
          erc721Tokens,
          erc721Activities,
          erc721Contracts
        );
        erc721Handler.process();
        await this.updateErc721(
          erc721Activities,
          Object.values(erc721Handler.erc721Tokens),
          trx
        );
      }
      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
  }

  async handleMissingErc721Contract(events: EvmEvent[], trx: Knex.Transaction) {
    const eventsUniqByAddress = _.keyBy(events, (e) => e.address);
    const missingErc721ContractsAddress: string[] = Array.from(
      new Set(events.filter((e) => e.track === null).map((e) => e.address))
    );
    if (missingErc721ContractsAddress.length > 0) {
      const erc721ContractsInfo = await this.getBatchErc721Info(
        missingErc721ContractsAddress as `0x${string}`[]
      );
      await Erc721Contract.query()
        .insert(
          missingErc721ContractsAddress.map((addr, index) =>
            Erc721Contract.fromJson({
              evm_smart_contract_id:
                eventsUniqByAddress[addr].evm_smart_contract_id,
              address: addr,
              symbol: erc721ContractsInfo[index].symbol,
              name: erc721ContractsInfo[index].name,
              track: false,
              last_updated_height: -1,
            })
          )
        )
        .transacting(trx);
    }
  }

  async updateErc721(
    erc721Activities: Erc721Activity[],
    erc721Tokens: Erc721Token[],
    trx: Knex.Transaction
  ) {
    let updatedTokens: Dictionary<Erc721Token> = {};
    if (erc721Tokens.length > 0) {
      updatedTokens = _.keyBy(
        await Erc721Token.query()
          .insert(
            erc721Activities.map((activity) =>
              Erc721Token.fromJson({
                token_id: activity.token_id,
                owner: activity.to,
                erc721_contract_address: activity.erc721_contract_address,
                last_updated_height: activity.height,
                burned: false,
              })
            )
          )
          .onConflict(['token_id', 'erc721_contract_id'])
          .merge()
          .transacting(trx),
        (o) => `${o.erc721_contract_id}_${o.token_id}`
      );
    }
    if (erc721Activities.length > 0) {
      erc721Activities.forEach((activity) => {
        const token =
          updatedTokens[
            `${activity.erc721_contract_address}_${activity.token_id}`
          ];
        // eslint-disable-next-line no-param-reassign
        activity.erc721_token_id = token.id;
      });
      await knex
        .batchInsert(
          'erc721_activity',
          erc721Activities,
          config.erc721.chunkSizeInsert
        )
        .transacting(trx);
    }
  }

  async getErc721Instances(evmSmartContracts: EVMSmartContract[]) {
    const addresses = evmSmartContracts.map((e) => e.address);
    const erc721ContractsInfo = await this.getBatchErc721Info(
      addresses as `0x${string}`[]
    );
    return evmSmartContracts.map((e, index) =>
      Erc721Contract.fromJson({
        evm_smart_contract_id: evmSmartContracts[index].id,
        address: e.address,
        symbol: erc721ContractsInfo[index].symbol,
        name: erc721ContractsInfo[index].name,
        track: true,
        last_updated_height: e.created_height,
      })
    );
  }

  async getBatchErc721Info(addresses: `0x${string}`[]) {
    const viemClient = EtherJsClient.getViemClient();
    const contracts = addresses.map((address) =>
      getContract({
        address,
        abi: Erc721Contract.ABI,
        client: viemClient,
      })
    );
    const batchReqs: any[] = [];
    contracts.forEach((e) => {
      batchReqs.push(
        e.read.name().catch(() => Promise.resolve(undefined)),
        e.read.symbol().catch(() => Promise.resolve(undefined))
      );
    });
    const results = await Promise.all(batchReqs);
    return addresses.map((address, index) => ({
      address,
      name: results[2 * index],
      symbol: results[2 * index + 1],
    }));
  }

  public async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
      BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.erc721.millisecondRepeatJob,
        },
      }
    );
    await this.createJob(
      BULL_JOB_NAME.HANDLE_ERC721_ACTIVITY,
      BULL_JOB_NAME.HANDLE_ERC721_ACTIVITY,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.erc721.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
