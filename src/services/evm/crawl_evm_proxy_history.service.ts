/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { ethers } from 'ethers';
import _ from 'lodash';
import {
  decodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toHex,
} from 'viem';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import {
  BlockCheckpoint,
  EvmEvent,
  EvmProxyHistory,
  EVMSmartContract,
} from '../../models';
import { ContractHelper } from './helpers/contract_helper';
import EtherJsClient from '../../common/utils/etherjs_client';
import knex from '../../common/utils/db_connection';
import { EIPProxyContractSupportByteCode } from './constant';

const Erc1967Events = {
  upgraded: {
    event: keccak256(toHex('Upgraded(address)')), // Upgraded(address indexed implementation) Emitted when the implementation is upgraded.
    abiParams: 'address implementation',
  },
  adminChanged: {
    event: keccak256(toHex('AdminChanged(address,address)')), // AdminChanged(address previousAdmin, address newAdmin)  Emitted when the admin account has changed.
    abiParams: 'address previousAdmin, address newAdmin',
  },
  beaconUpgraded: {
    event: keccak256(toHex('BeaconUpgraded(address)')), // BeaconUpgraded(address indexed beacon) Emitted when the beacon is upgraded.
    abiParams: 'address beacon',
  },
};

@Service({
  name: SERVICE.V1.CrawlEvmProxyHistory.key,
  version: 1,
})
export default class CrawlProxyContractEVMService extends BullableService {
  private etherJsClient!: ethers.AbstractProvider;

  private contractHelper!: ContractHelper;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_EVM_PROXY_HISTORY,
    jobName: BULL_JOB_NAME.HANDLE_EVM_PROXY_HISTORY,
  })
  public async jobHandler() {
    const newProxyHistories: EvmProxyHistory[] = [];
    const [startBlock, endBlock, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_EVM_PROXY_HISTORY,
        [BULL_JOB_NAME.CRAWL_SMART_CONTRACT_EVM],
        config.crawlEvmProxyHistory.key
      );
    this.logger.info(
      `Crawl Evm proxy history from block ${startBlock} to block ${endBlock}`
    );
    const evmEvents = await EvmEvent.query()
      .select('*')
      .where('block_height', '>', startBlock)
      .andWhere('block_height', '<=', endBlock);
    const proxyContractDb = await EVMSmartContract.query().whereIn('type', [
      EVMSmartContract.TYPES.PROXY_EIP_1967,
      EVMSmartContract.TYPES.PROXY_EIP_1822,
      EVMSmartContract.TYPES.PROXY_OPEN_ZEPPELIN_IMPLEMENTATION,
    ]);

    for (const evmEvent of evmEvents) {
      let [adminAddress, implementationAddress, beaconAddress]: unknown[] = [
        null,
        null,
        null,
      ];
      const anyProxyHistory = await EvmProxyHistory.query()
        .where('proxy_contract', '=', _.toLower(evmEvent.address))
        .andWhereNot('last_updated_height', null);
      const evmEventProxy: EVMSmartContract = _.find(proxyContractDb, {
        address: evmEvent.address,
      }) as EVMSmartContract;
      const firstTimeCatchProxyEvent =
        proxyContractDb.find((proxy) => proxy.address === evmEvent.address) &&
        anyProxyHistory.length === 0;
      const newJSONProxy = {} as any;

      switch (evmEvent.topic0) {
        case Erc1967Events.upgraded.event:
          [implementationAddress] = decodeAbiParameters(
            parseAbiParameters(Erc1967Events.upgraded.abiParams),
            evmEvent.topic1 as any
          );
          break;
        case Erc1967Events.adminChanged.event:
          [, adminAddress] = decodeAbiParameters(
            parseAbiParameters(Erc1967Events.adminChanged.abiParams),
            toHex(evmEvent.data)
          );
          break;
        case Erc1967Events.beaconUpgraded.event:
          beaconAddress = decodeAbiParameters(
            parseAbiParameters(Erc1967Events.beaconUpgraded.abiParams),
            evmEvent.topic1 as any
          );
          break;
        default:
          if (firstTimeCatchProxyEvent) {
            implementationAddress = await this.contractHelper.isContractProxy(
              evmEvent.address,
              _.find(
                EIPProxyContractSupportByteCode,
                (value, __) => value.TYPE === evmEventProxy.type
              )?.SLOT
            );

            newJSONProxy.last_updated_height =
              await this.etherJsClient.getBlockNumber();
          }
          break;
      }

      newJSONProxy.proxy_contract = _.toLower(evmEvent.address);
      newJSONProxy.admin = _.toLower(adminAddress as string) || null;
      newJSONProxy.implementation_contract =
        _.toLower(implementationAddress as string) || beaconAddress || null;
      newJSONProxy.block_height = evmEvent.block_height;
      newJSONProxy.tx_hash = evmEvent.tx_hash;

      newProxyHistories.push(EvmProxyHistory.fromJson(newJSONProxy));
    }

    const newProxyContractsToSave = _.filter(
      newProxyHistories,
      (proxyContract) =>
        proxyContract.admin !== null ||
        proxyContract.implementation_contract !== null
    );

    await knex.transaction(async (trx) => {
      if (newProxyContractsToSave.length > 0) {
        // Unique proxy contract when have multiple events in same block.
        const groupedProxyContract = _.groupBy(
          newProxyContractsToSave,
          (proxy) => proxy.proxy_contract + proxy.block_height
        );
        const mergedProxyContract: EvmProxyHistory[] = _.map(
          groupedProxyContract,
          (group) =>
            // eslint-disable-next-line consistent-return
            _.mergeWith({}, ...group, (obj: any, attribute: null) => {
              if (attribute === null) {
                return obj;
              }
            })
        );

        await EvmProxyHistory.query()
          .insert(mergedProxyContract)
          .onConflict(['proxy_contract', 'block_height'])
          .merge()
          .returning('id')
          .transacting(trx);
      }

      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id')
        .transacting(trx);
    });
  }

  public async _start() {
    this.etherJsClient = new EtherJsClient().etherJsClient;
    this.contractHelper = new ContractHelper(this.etherJsClient);

    this.createJob(
      BULL_JOB_NAME.HANDLE_EVM_PROXY_HISTORY,
      BULL_JOB_NAME.HANDLE_EVM_PROXY_HISTORY,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlEvmProxyHistory.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
