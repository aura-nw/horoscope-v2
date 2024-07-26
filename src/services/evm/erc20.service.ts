import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Knex } from 'knex';
import _ from 'lodash';
import { Context, ServiceBroker } from 'moleculer';
import { PublicClient, getContract } from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { SERVICE as COSMOS_SERVICE, Config } from '../../common';
import knex from '../../common/utils/db_connection';
import { getViemClient } from '../../common/utils/etherjs_client';
import { BlockCheckpoint, EVMSmartContract } from '../../models';
import { Erc20Activity } from '../../models/erc20_activity';
import { Erc20Contract } from '../../models/erc20_contract';
import { BULL_JOB_NAME, SERVICE as EVM_SERVICE, SERVICE } from './constant';
import { Erc20Handler } from './erc20_handler';
import { Erc20Reindexer } from './erc20_reindex';
import { convertEthAddressToBech32Address } from './utils';

const { NODE_ENV } = Config;
@Service({
  name: EVM_SERVICE.V1.Erc20.key,
  version: 1,
})
export default class Erc20Service extends BullableService {
  viemClient!: PublicClient;

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
        .transacting(trx)
        .where('created_height', '>', startBlock)
        .andWhere('created_height', '<=', endBlock)
        .andWhere('type', EVMSmartContract.TYPES.ERC20)
        .orderBy('id', 'asc');
      if (erc20SmartContracts.length > 0) {
        const erc20Instances = await this.getErc20Instances(
          erc20SmartContracts
        );
        this.logger.info(
          `Crawl Erc20 contract from block ${startBlock} to block ${endBlock}:\n ${JSON.stringify(
            erc20Instances
          )}`
        );
        await Erc20Contract.query()
          .transacting(trx)
          .insert(erc20Instances)
          .onConflict(['address'])
          .merge();
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
    queueName: BULL_JOB_NAME.HANDLE_ERC20_ACTIVITY,
    jobName: BULL_JOB_NAME.HANDLE_ERC20_ACTIVITY,
  })
  async handleErc20Activity(): Promise<void> {
    await knex.transaction(async (trx) => {
      const [startBlock, endBlock, updateBlockCheckpoint] =
        await BlockCheckpoint.getCheckpoint(
          BULL_JOB_NAME.HANDLE_ERC20_ACTIVITY,
          [
            BULL_JOB_NAME.HANDLE_ERC20_CONTRACT,
            BULL_JOB_NAME.HANDLE_EVM_PROXY_HISTORY,
          ],
          config.erc20.key
        );
      const erc20Activities: Erc20Activity[] =
        await Erc20Handler.buildErc20Activities(
          startBlock,
          endBlock,
          trx,
          this.logger
        );
      await this.handleMissingErc20Contract(erc20Activities, trx);
      if (erc20Activities.length > 0) {
        this.logger.info(
          `Crawl Erc20 activity from block ${startBlock} to block ${endBlock}:\n ${JSON.stringify(
            erc20Activities
          )}`
        );
        await knex
          .batchInsert(
            'erc20_activity',
            erc20Activities,
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

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_ERC20_BALANCE,
    jobName: BULL_JOB_NAME.HANDLE_ERC20_BALANCE,
  })
  async handleErc20Balance(): Promise<void> {
    const [startBlock, endBlock, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_ERC20_BALANCE,
        [BULL_JOB_NAME.HANDLE_ERC20_ACTIVITY],
        config.erc20.key
      );
    // get Erc20 activities
    let erc20Activities = await Erc20Handler.getErc20Activities(
      startBlock,
      endBlock
    );
    // get missing Account
    const missingAccountsAddress = Array.from(
      new Set(
        (
          [
            ...erc20Activities
              .filter((e) => !e.from_account_id)
              .map((e) => e.from),
            ...erc20Activities.filter((e) => !e.to_account_id).map((e) => e.to),
          ] as string[]
        ).map((e) =>
          convertEthAddressToBech32Address(config.networkPrefixAddress, e)
        )
      )
    );
    if (missingAccountsAddress.length > 0) {
      // crawl missing Account and requery erc20Activities
      await this.broker.call(
        COSMOS_SERVICE.V1.HandleAddressService.CrawlNewAccountApi.path,
        {
          addresses: missingAccountsAddress,
        }
      );
      erc20Activities = await Erc20Handler.getErc20Activities(
        startBlock,
        endBlock
      );
    }
    await knex.transaction(async (trx) => {
      await Erc20Handler.updateErc20AccountsBalance(erc20Activities, trx);
      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.REINDEX_ERC20,
    jobName: BULL_JOB_NAME.REINDEX_ERC20,
  })
  async reindexErc20(_payload: { address: `0x${string}` }): Promise<void> {
    const { address } = _payload;
    const erc20Reindexer = new Erc20Reindexer(this.viemClient, this.logger);
    await erc20Reindexer.reindex(address.toLowerCase() as `0x${string}`);
    this.logger.info(`Reindex erc20 contract ${address} done.`);
  }

  @Action({
    name: SERVICE.V1.Erc20.reindexing.key,
    params: {
      addresses: {
        type: 'array',
        items: 'string',
        optional: false,
      },
    },
  })
  public async reindexing(
    ctx: Context<{
      addresses: `0x${string}`[];
    }>
  ) {
    const { addresses } = ctx.params;
    if (addresses.length > 0) {
      await Promise.all(
        addresses.map((address) =>
          this.createJob(
            BULL_JOB_NAME.REINDEX_ERC20,
            BULL_JOB_NAME.REINDEX_ERC20,
            {
              address,
            },
            {
              jobId: address,
              removeOnComplete: true,
            }
          )
        )
      );
    }
  }

  @Action({
    name: SERVICE.V1.Erc20.insertNewErc20Contracts.key,
    params: {
      evmSmartContracts: 'any[]',
    },
  })
  async insertNewErc20Contracts(
    ctx: Context<{
      evmSmartContracts: {
        id: number;
        address: string;
      }[];
    }>
  ) {
    const { evmSmartContracts } = ctx.params;
    if (evmSmartContracts.length > 0) {
      const currentHeight = await this.viemClient.getBlockNumber();
      const erc20Instances = await this.getErc20Instances(
        evmSmartContracts.map((e) =>
          EVMSmartContract.fromJson({
            ...e,
            created_height: currentHeight.toString(),
          })
        )
      );
      this.logger.info(
        `New Erc20 Instances:\n ${JSON.stringify(erc20Instances)}`
      );
      await Erc20Contract.query()
        .insert(erc20Instances)
        .onConflict(['address'])
        .merge();
    }
  }

  async handleMissingErc20Contract(
    erc20Activities: Erc20Activity[],
    trx: Knex.Transaction
  ) {
    const addresses = _.uniq(
      erc20Activities.map((activity) => activity.erc20_contract_address)
    );
    const erc20ContractsByAddress = _.keyBy(
      await Erc20Contract.query().whereIn('address', addresses),
      (e) => e.address
    );

    const evmSmartContracts = _.keyBy(
      await EVMSmartContract.query().whereIn('address', addresses),
      (e) => e.address
    );

    const missingErc20ContractsAddress: string[] = addresses.filter(
      (addr) => !erc20ContractsByAddress[addr]
    );
    if (missingErc20ContractsAddress.length > 0) {
      const erc20ContractsInfo = await this.getBatchErc20Info(
        missingErc20ContractsAddress as `0x${string}`[]
      );
      await Erc20Contract.query()
        .insert(
          missingErc20ContractsAddress.map((addr, index) =>
            Erc20Contract.fromJson({
              evm_smart_contract_id: evmSmartContracts[addr].id,
              address: addr,
              total_supply: erc20ContractsInfo[index].totalSupply,
              symbol: erc20ContractsInfo[index].symbol,
              decimal: erc20ContractsInfo[index].decimals,
              name: erc20ContractsInfo[index].name,
              track: false,
              last_updated_height: -1,
            })
          )
        )
        .transacting(trx);
    }
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
    const contracts = addresses.map((address) =>
      getContract({
        address,
        abi: Erc20Contract.ABI,
        client: this.viemClient,
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
    this.viemClient = getViemClient();
    if (NODE_ENV !== 'test') {
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
      await this.createJob(
        BULL_JOB_NAME.HANDLE_ERC20_ACTIVITY,
        BULL_JOB_NAME.HANDLE_ERC20_ACTIVITY,
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
      await this.createJob(
        BULL_JOB_NAME.HANDLE_ERC20_BALANCE,
        BULL_JOB_NAME.HANDLE_ERC20_BALANCE,
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
    }
    return super._start();
  }
}
