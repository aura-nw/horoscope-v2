import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { PublicClient, getContract } from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import '../../../fetch-polyfill.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import EtherJsClient from '../../common/utils/etherjs_client';
import { BlockCheckpoint, EVMSmartContract } from '../../models';
import { Erc20Contract } from '../../models/erc20_contract';

@Service({
  name: SERVICE.V1.Erc20.key,
  version: 1,
})
export default class Erc20Service extends BullableService {
  etherJsClient!: PublicClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ERC20_CONTRACT,
    jobName: BULL_JOB_NAME.HANDLE_ERC20_CONTRACT,
  })
  async handleErc20Contract(): Promise<void> {
    await knex.transaction(async (trx) => {
      // get id evm smart contract checkpoint
      // get range blocks for proccessing
      const [startBlock, endBlock, updateBlockCheckpoint] =
        await BlockCheckpoint.getCheckpoint(
          BULL_JOB_NAME.HANDLE_ERC20_CONTRACT,
          [BULL_JOB_NAME.CRAWL_SMART_CONTRACT_EVM],
          config.erc20.key
        );
      const erc20SmartContracts = await EVMSmartContract.query()
        .where('created_height', '>', startBlock)
        .andWhere('created_height', '<=', endBlock)
        .andWhere('type', EVMSmartContract.TYPES.ERC20)
        .orderBy('id', 'asc');
      if (erc20SmartContracts.length > 0) {
        const erc20Instances = await this.getErc20Instances(
          erc20SmartContracts
        );
        await Erc20Contract.query().transacting(trx).insert(erc20Instances);
      }
      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
  }

  async getErc20Instances(evmSmartContracts: EVMSmartContract[]) {
    const addresses = evmSmartContracts.map((e) => e.address);
    const erc20ContractsInfo = await this.getBatchErc20Info(
      addresses as `0x${string}`[]
    );
    return evmSmartContracts.map((e, index) =>
      Erc20Contract.fromJson({
        evm_smart_contract_id: evmSmartContracts[index].id,
        address: e.address,
        total_supply: erc20ContractsInfo[index].totalSupply,
        symbol: erc20ContractsInfo[index].symbol,
        decimal: erc20ContractsInfo[index].decimals,
        name: erc20ContractsInfo[index].name,
        track: true,
        last_updated_height: e.created_height,
      })
    );
  }

  async getBatchErc20Info(addresses: `0x${string}`[]) {
    const viemClient = EtherJsClient.getViemClient();
    const contracts = addresses.map((address) =>
      getContract({
        address,
        abi: Erc20Contract.ABI,
        client: viemClient,
      })
    );
    const batchReqs: any[] = [];
    contracts.forEach((e) => {
      batchReqs.push(
        e.read.name().catch(() => Promise.resolve(undefined)),
        e.read.symbol().catch(() => Promise.resolve(undefined)),
        e.read.decimals().catch(() => Promise.resolve(undefined)),
        e.read.totalSupply().catch(() => Promise.resolve(undefined))
      );
    });
    const results = await Promise.all(batchReqs);
    return addresses.map((address, index) => ({
      address,
      name: results[4 * index],
      symbol: results[4 * index + 1],
      decimals: results[4 * index + 2],
      totalSupply: results[4 * index + 3]?.toString(),
    }));
  }

  public async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.HANDLE_ERC20_CONTRACT,
      BULL_JOB_NAME.HANDLE_ERC20_CONTRACT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.erc20.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
