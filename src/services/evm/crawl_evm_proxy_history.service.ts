/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ethers } from 'ethers';
import _ from 'lodash';
import { ServiceBroker } from 'moleculer';
import {
  decodeAbiParameters,
  keccak256,
  parseAbiParameters,
  toHex,
} from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import knex from '../../common/utils/db_connection';
import EtherJsClient from '../../common/utils/etherjs_client';
import {
  BlockCheckpoint,
  EVMSmartContract,
  EvmEvent,
  EvmProxyHistory,
} from '../../models';
import {
  BULL_JOB_NAME,
  EIPProxyContractSupportByteCode,
  SERVICE,
} from './constant';
import { ContractHelper } from './helpers/contract_helper';

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
      let implementationAddress = null;
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
        // TODO: support beacon soon
        // case Erc1967Events.adminChanged.event:
        //   [, adminAddress] = decodeAbiParameters(
        //     parseAbiParameters(Erc1967Events.adminChanged.abiParams),
        //     toHex(evmEvent.data)
        //   );
        //   break;
        // case Erc1967Events.beaconUpgraded.event:
        //   beaconAddress = decodeAbiParameters(
        //     parseAbiParameters(Erc1967Events.beaconUpgraded.abiParams),
        //     evmEvent.topic1 as any
        //   );
        //   break;
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
      newJSONProxy.implementation_contract =
        _.toLower(implementationAddress as string) || null;
      newJSONProxy.block_height = evmEvent.block_height;
      newJSONProxy.tx_hash = evmEvent.tx_hash;

      newProxyHistories.push(EvmProxyHistory.fromJson(newJSONProxy));
    }

    const newProxyContractsToSave = _.filter(
      newProxyHistories,
      (proxyContract) => proxyContract.implementation_contract !== null
    );
    const newProxyContracts: EvmProxyHistory[] = [];
    await knex.transaction(async (trx) => {
      if (newProxyContractsToSave.length > 0) {
        // Unique proxy contract when have multiple events in same block.
        const groupedProxyContract = _.groupBy(
          newProxyContractsToSave,
          (proxy) => proxy.proxy_contract + proxy.block_height
        );
        const mergedProxyContracts: EvmProxyHistory[] = _.map(
          groupedProxyContract,
          (group) =>
            // eslint-disable-next-line consistent-return
            _.mergeWith({}, ...group, (obj: any, attribute: null) => {
              if (attribute === null) {
                return obj;
              }
            })
        );

        newProxyContracts.push(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ...(await EvmProxyHistory.query()
            .insert(mergedProxyContracts)
            .onConflict(['proxy_contract', 'block_height'])
            .merge()
            .returning('id')
            .transacting(trx))
        );
      }

      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id')
        .transacting(trx);
    });
    // handle erc20 proxies
    await this.handleErc20ProxyContracts(newProxyContracts);
  }

  async handleErc20ProxyContracts(proxyContracts: EvmProxyHistory[]) {
    const erc20ProxyContracts = await EvmProxyHistory.query()
      .leftJoin(
        'evm_smart_contract as proxy',
        'evm_proxy_history.proxy_contract',
        'proxy.address'
      )
      .leftJoin(
        'evm_smart_contract as implementation',
        'evm_proxy_history.implementation_contract',
        'implementation.address'
      )
      .where('implementation.type', EVMSmartContract.TYPES.ERC20)
      .whereIn(
        'evm_proxy_history.id',
        proxyContracts.map((e) => e.id)
      )
      .select('evm_proxy_history.proxy_contract as address', 'proxy.id as id');
    await this.broker.call(SERVICE.V1.Erc20.insertNewErc20Contracts.path, {
      evmSmartContracts: erc20ProxyContracts,
    });
  }

  public async _start() {
    this.etherJsClient = new EtherJsClient().etherJsClient;
    this.contractHelper = new ContractHelper(this.etherJsClient);

    await this.createJob(
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
