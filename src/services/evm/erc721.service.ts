import { Service } from '@ourparentcenter/moleculer-decorators-extended';
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
  async handleErc20Activity(): Promise<void> {
    await knex.transaction(async (trx) => {
      const [startBlock, endBlock, updateBlockCheckpoint] =
        await BlockCheckpoint.getCheckpoint(
          BULL_JOB_NAME.HANDLE_ERC721_ACTIVITY,
          [BULL_JOB_NAME.HANDLE_ERC721_CONTRACT],
          config.erc20.key
        );
      // TODO: handle track erc20 contract only
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
          console.log('abc');
        } else if (e.topic0 === ERC721_EVENT_TOPIC0.APPROVAL_FOR_ALL) {
          console.log('def');
        }
      });
      if (erc721Activities.length > 0) {
        await knex
          .batchInsert(
            'erc721_activity',
            erc721Activities,
            config.erc20.chunkSizeInsert
          )
          .transacting(trx);
      }
      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
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
