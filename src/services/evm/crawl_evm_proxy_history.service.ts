/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import _, { Dictionary } from 'lodash';
import { Context, ServiceBroker } from 'moleculer';
import {
  PublicClient,
  decodeAbiParameters,
  keccak256,
  parseAbiParameters,
  toHex,
} from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import knex from '../../common/utils/db_connection';
import { getViemClient } from '../../common/utils/etherjs_client';
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
  viemClient!: PublicClient;

  private contractHelper!: ContractHelper;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_EVM_PROXY_HISTORY,
    jobName: BULL_JOB_NAME.HANDLE_EVM_PROXY_HISTORY,
  })
  public async jobHandler() {
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
      .andWhere('block_height', '<=', endBlock)
      .select('address', 'topic0', 'topic1', 'block_height', 'tx_hash');
    const distictAddresses = _.uniq(evmEvents.map((e) => e.address));
    const proxyContractDb = await EVMSmartContract.query()
      .whereIn('type', [
        EVMSmartContract.TYPES.PROXY_EIP_1967,
        EVMSmartContract.TYPES.PROXY_EIP_1822,
        EVMSmartContract.TYPES.PROXY_OPEN_ZEPPELIN_IMPLEMENTATION,
        EVMSmartContract.TYPES.PROXY_EIP_1167,
        EVMSmartContract.TYPES.PROXY_EIP_1967_BEACON,
      ])
      .andWhere('address', 'in', distictAddresses)
      .select('address');
    const batchReqs: any[] = [];
    distictAddresses.forEach((address) => {
      batchReqs.push(
        this.viemClient.getBytecode({
          address: address as `0x${string}`,
        })
      );
    });
    const results = await Promise.all(batchReqs);
    const bytecodes: Dictionary<string> = {};
    distictAddresses.forEach((address, index) => {
      bytecodes[address] = results[index];
    });
    const lastUpdatedHeight = await this.viemClient.getBlockNumber();
    const anyProxyHistoryByAddress = _.keyBy(
      await EvmProxyHistory.query()
        .whereIn(
          'proxy_contract',
          evmEvents.map((e) => _.toLower(e.address))
        )
        .andWhereNot('last_updated_height', null),
      'proxy_contract'
    );
    const getProxyPromises = evmEvents.map(async (evmEvent) => {
      let implementationAddress = null;
      const evmEventProxy: EVMSmartContract = _.find(proxyContractDb, {
        address: evmEvent.address,
      }) as EVMSmartContract;
      const firstTimeCatchProxyEvent =
        proxyContractDb.find((proxy) => proxy.address === evmEvent.address) &&
        !anyProxyHistoryByAddress[evmEvent.address];
      const newJSONProxy: Dictionary<any> = {};

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
            implementationAddress = (
              await this.contractHelper.isContractProxy(
                evmEvent.address,
                _.find(
                  EIPProxyContractSupportByteCode,
                  (value, __) => value.TYPE === evmEventProxy.type
                )?.SLOT,
                undefined,
                bytecodes[evmEvent.address]
              )
            )?.logicContractAddress;
          }
          break;
      }

      newJSONProxy.proxy_contract = _.toLower(evmEvent.address);
      if (implementationAddress) {
        newJSONProxy.implementation_contract = _.toLower(
          implementationAddress as string
        );
      } else {
        newJSONProxy.implementation_contract = null;
      }
      newJSONProxy.block_height = evmEvent.block_height;
      newJSONProxy.tx_hash = evmEvent.tx_hash;
      newJSONProxy.last_updated_height = lastUpdatedHeight;
      return EvmProxyHistory.fromJson(newJSONProxy);
    });
    const newProxyHistories: EvmProxyHistory[] = await Promise.all(
      getProxyPromises
    );
    // check evm_smart_contract if proxy_contract is existed
    const foundContractsInDB = _.keyBy(
      await EVMSmartContract.query().whereIn(
        'address',
        newProxyHistories.map((e) => e.proxy_contract)
      ),
      'address'
    );
    const newProxyContractsToSave: EvmProxyHistory[] = [];
    newProxyHistories.forEach((proxyHistory) => {
      if (
        proxyHistory.implementation_contract !== null &&
        foundContractsInDB[proxyHistory.proxy_contract] !== undefined
      ) {
        newProxyContractsToSave.push(proxyHistory);
      } else {
        this.logger.debug(
          `This contract address ${proxyHistory.proxy_contract} is not proxy, at tx hash ${proxyHistory.tx_hash}`
        );
      }
    });
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
    await this.handleTypeProxyContracts(newProxyContracts);
  }

  @Action({
    name: SERVICE.V1.CrawlEvmProxyHistory.handleTypeProxyContracts.key,
    params: {
      proxyHistoryIds: {
        type: 'array',
        items: 'number',
        required: true,
      },
    },
  })
  public async actionHandleTypeProxyContracts(
    ctx: Context<{ proxyHistoryIds: number[] }>
  ) {
    const ids = ctx.params.proxyHistoryIds;
    // handle erc20 proxies
    await this.handleErc20ProxyContracts(
      ids.map((id) =>
        EvmProxyHistory.fromJson({
          id,
        })
      )
    );
    // handle erc721 proxies
    await this.handleErc721ProxyContracts(
      ids.map((id) =>
        EvmProxyHistory.fromJson({
          id,
        })
      )
    );
  }

  async handleTypeProxyContracts(proxyContracts: EvmProxyHistory[]) {
    // handle erc20 proxies
    await this.handleErc20ProxyContracts(proxyContracts);
    // handle erc721 proxies
    await this.handleErc721ProxyContracts(proxyContracts);
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
    await this.createJob(
      BULL_JOB_NAME.INSERT_ERC20_CONTRACT,
      BULL_JOB_NAME.INSERT_ERC20_CONTRACT,
      {
        evmSmartContracts: [
          ...new Map(
            erc20ProxyContracts.map((item) => [item.address, item])
          ).values(),
        ],
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: config.jobRetryAttempt,
        backoff: config.jobRetryBackoff,
      }
    );
  }

  async handleErc721ProxyContracts(proxyContracts: EvmProxyHistory[]) {
    const erc721ProxyContracts = await EvmProxyHistory.query()
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
      .where('implementation.type', EVMSmartContract.TYPES.ERC721)
      .whereIn(
        'evm_proxy_history.id',
        proxyContracts.map((e) => e.id)
      )
      .select('evm_proxy_history.proxy_contract as address', 'proxy.id as id');
    await this.createJob(
      BULL_JOB_NAME.INSERT_ERC721_CONTRACT,
      BULL_JOB_NAME.INSERT_ERC721_CONTRACT,
      {
        evmSmartContracts: [
          ...new Map(
            erc721ProxyContracts.map((item) => [item.address, item])
          ).values(),
        ],
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: config.jobRetryAttempt,
        backoff: config.jobRetryBackoff,
      }
    );
  }

  public async _start() {
    this.viemClient = getViemClient();
    this.contractHelper = new ContractHelper(this.viemClient);

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
