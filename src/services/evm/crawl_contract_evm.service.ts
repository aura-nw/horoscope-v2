import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { whatsabi } from '@shazow/whatsabi';
import _, { Dictionary } from 'lodash';
import { ServiceBroker } from 'moleculer';
import {
  GetBytecodeReturnType,
  PublicClient,
  bytesToHex,
  keccak256,
} from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import knex from '../../common/utils/db_connection';
import { getViemClient } from '../../common/utils/etherjs_client';
import {
  BlockCheckpoint,
  EVMSmartContract,
  EVMTransaction,
  EvmEvent,
  EvmInternalTransaction,
} from '../../models';
import {
  BULL_JOB_NAME,
  DetectEVMProxyContract,
  EIPProxyContractSupportByteCode,
  EVM_CONTRACT_METHOD_HEX_PREFIX,
  SERVICE,
} from './constant';
import { ContractHelper } from './helpers/contract_helper';

@Service({
  name: SERVICE.V1.CrawlSmartContractEVM.key,
  version: 1,
})
export default class CrawlSmartContractEVMService extends BullableService {
  viemClient!: PublicClient;

  private contractHelper!: ContractHelper;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_SMART_CONTRACT_EVM,
    jobName: BULL_JOB_NAME.CRAWL_SMART_CONTRACT_EVM,
  })
  async jobHandler() {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_SMART_CONTRACT_EVM,
        [
          BULL_JOB_NAME.JOB_CRAWL_EVM_EVENT,
          BULL_JOB_NAME.EVM_CRAWL_INTERNAL_TX,
        ],
        config.crawlSmartContractEVM.key
      );
    this.logger.info(
      `Crawl EVM smart contract from block ${startBlock} to block ${endBlock}`
    );
    if (startBlock >= endBlock) {
      return;
    }

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
      return;
    }
    const evmTxs = await EVMTransaction.query()
      .select(
        'evm_transaction.height',
        'evm_transaction.hash',
        'evm_transaction.from',
        'evm_transaction.to',
        'evm_transaction.contract_address as contractAddress',
        'evm_transaction.data',
        'evm_transaction.id'
      )
      .withGraphFetched('[evm_events, evm_internal_transactions]')
      .modifyGraph('evm_events', (builder) => {
        builder
          .select(knex.raw('ARRAY_AGG(address) as event_address'))
          .andWhere('evm_tx_id', '>=', fromTx.id)
          .andWhere('evm_tx_id', '<=', toTx.id)
          .groupBy('evm_tx_id')
          .orderBy('evm_tx_id');
      })
      .modifyGraph('evm_internal_transactions', (builder) => {
        builder
          .select('to')
          .whereIn('type', [
            EvmInternalTransaction.TYPE.CREATE,
            EvmInternalTransaction.TYPE.CREATE2,
          ])
          .andWhere('evm_tx_id', '>=', fromTx.id)
          .andWhere('evm_tx_id', '<=', toTx.id)
          .andWhere('error', null);
      })
      .where('evm_transaction.height', '>', startBlock)
      .andWhere('evm_transaction.height', '<=', endBlock)
      .orderBy('evm_transaction.height', 'ASC')
      .orderBy('evm_transaction.index', 'ASC');

    let addresses: string[] = [];
    const txCreationWithAdressses: Dictionary<EVMTransaction> = {};
    evmTxs.forEach((evmTx: any) => {
      ['from', 'to', 'data', 'contractAddress'].forEach((key) => {
        if (evmTx[key]) {
          // eslint-disable-next-line no-param-reassign
          evmTx[key] = bytesToHex(evmTx[key]);
        }
      });
      const { data, contractAddress } = evmTx;
      let currentAddresses: string[] = [];
      ['from', 'to', 'contractAddress'].forEach((key) => {
        if (evmTx[key] && evmTx[key].startsWith('0x')) {
          currentAddresses.push(evmTx[key]);
          if (
            data &&
            (data.startsWith(EVM_CONTRACT_METHOD_HEX_PREFIX.CREATE_CONTRACT) ||
              contractAddress)
          ) {
            txCreationWithAdressses[evmTx[key]] = evmTx;
          }
        }
      });

      if (
        evmTx.evm_events.length > 0 &&
        evmTx.evm_events[0].event_address.length > 0
      ) {
        currentAddresses.push(...evmTx.evm_events[0].event_address);
        if (
          data &&
          (data.startsWith(EVM_CONTRACT_METHOD_HEX_PREFIX.CREATE_CONTRACT) ||
            contractAddress)
        ) {
          evmTx.evm_events[0].event_address.forEach((addr: string) => {
            txCreationWithAdressses[addr] = evmTx;
          });
        }
      }
      evmTx.evm_internal_transactions.forEach(
        (creationInternalTx: EvmInternalTransaction) => {
          currentAddresses.push(creationInternalTx.to);
          txCreationWithAdressses[creationInternalTx.to] = evmTx;
        }
      );
      currentAddresses = _.uniq(currentAddresses);
      addresses.push(...currentAddresses);
    });

    addresses = _.uniq(addresses);

    const evmContracts: EVMSmartContract[] = [];

    const evmContractsInDB: EVMSmartContract[] = await EVMSmartContract.query()
      .select('address')
      .whereIn('address', addresses)
      .andWhere('status', EVMSmartContract.STATUS.CREATED);

    const evmContractsWithAddress: any = [];
    evmContractsInDB.forEach((evmContract) => {
      evmContractsWithAddress[evmContract.address] = evmContract;
    });
    const notFoundAddresses = addresses.filter(
      (address: string) => !evmContractsWithAddress[address]
    );
    const bytecodesByAddress: _.Dictionary<GetBytecodeReturnType> =
      await this.getBytecodeContracts(notFoundAddresses);
    const beaconContracts = (
      await EvmEvent.query()
        .where('evm_tx_id', '>=', fromTx.id)
        .andWhere('evm_tx_id', '<=', toTx.id)
        .andWhere('topic0', EVMSmartContract.PROXY_EVENT_TOPIC0.BEACON_UPGRADED)
        .select('address', 'topic1')
    ).map((e) => ({
      address: e.address,
      beacon: `0x${e.topic1.slice(26)}`,
    }));
    const proxyInfoByAddress: _.Dictionary<DetectEVMProxyContract | null> =
      await this.getContractsProxyInfo(
        notFoundAddresses,
        bytecodesByAddress,
        beaconContracts
      );
    notFoundAddresses.forEach((address: string) => {
      const code = bytecodesByAddress[address];
      // check if this address has code -> is smart contract
      if (code) {
        let type = this.detectContractTypeByCode(code);
        const implementContractInfo = proxyInfoByAddress[address];
        if (implementContractInfo) {
          type = implementContractInfo.EIP as any;
        }
        const codeHash = keccak256(code);
        evmContracts.push(
          EVMSmartContract.fromJson({
            address,
            creator: txCreationWithAdressses[address]?.from,
            type,
            created_hash: txCreationWithAdressses[address]?.hash,
            created_height: txCreationWithAdressses[address]?.height,
            code_hash: codeHash,
            status: EVMSmartContract.STATUS.CREATED,
            last_updated_tx_id: txCreationWithAdressses[address]?.id,
          })
        );
      }
    });
    let newEvmContracts: EVMSmartContract[] = [];
    await knex.transaction(async (trx) => {
      if (evmContracts.length > 0) {
        newEvmContracts = _.uniqBy(evmContracts, 'address');
        await EVMSmartContract.query()
          .insert(newEvmContracts)
          .onConflict(['address'])
          .merge()
          .transacting(trx);
      }
      if (blockCheckpoint) {
        blockCheckpoint.height = endBlock;

        await BlockCheckpoint.query()
          .insert(blockCheckpoint)
          .onConflict('job_name')
          .merge()
          .returning('id')
          .transacting(trx);
      }
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_SELF_DESTRUCT,
    jobName: BULL_JOB_NAME.HANDLE_SELF_DESTRUCT,
  })
  async handleSelfDestruct() {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_SELF_DESTRUCT,
        [BULL_JOB_NAME.CRAWL_SMART_CONTRACT_EVM],
        config.crawlSmartContractEVM.key
      );
    this.logger.info(
      `Handle self-destruct from block ${startBlock} to block ${endBlock}`
    );
    if (startBlock >= endBlock) {
      return;
    }
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
      return;
    }
    const selfDestructEvents = _.keyBy(
      await EvmInternalTransaction.query()
        .where('evm_tx_id', '>=', fromTx.id)
        .andWhere('evm_tx_id', '<=', toTx.id)
        .andWhere(
          'evm_internal_transaction.type',
          EvmInternalTransaction.TYPE.SELFDESTRUCT
        )
        .andWhere('evm_internal_transaction.error', null)
        .select(
          'evm_internal_transaction.from',
          'evm_internal_transaction.evm_tx_id'
        )
        .orderBy('evm_internal_transaction.id'),
      'from'
    );
    await knex.transaction(async (trx) => {
      const destructContractsAddr = Object.keys(selfDestructEvents);
      if (destructContractsAddr.length > 0) {
        const selfDestructContracts = _.keyBy(
          await EVMSmartContract.query().whereIn(
            'address',
            destructContractsAddr
          ),
          'address'
        );
        const updateContracts = Object.keys(selfDestructContracts).filter(
          (e) =>
            parseInt(selfDestructEvents[e].evm_tx_id, 10) >=
            (selfDestructContracts[e]?.last_updated_tx_id || 0)
        );
        await EVMSmartContract.query()
          .patch({
            status: EVMSmartContract.STATUS.DELETED,
          })
          .whereIn('address', updateContracts)
          .transacting(trx);
      }
      if (blockCheckpoint) {
        blockCheckpoint.height = endBlock;
        await BlockCheckpoint.query()
          .insert(blockCheckpoint)
          .onConflict('job_name')
          .merge()
          .returning('id')
          .transacting(trx);
      }
    });
  }

  async getContractsProxyInfo(
    addrs: string[],
    bytecodes: _.Dictionary<GetBytecodeReturnType>,
    beaconContracts: {
      address: string;
      beacon: string;
    }[]
  ) {
    const result: _.Dictionary<DetectEVMProxyContract | null> = {};
    const proxiesInfo = await Promise.all(
      addrs.map(async (addr) => {
        const byteCode = bytecodes[addr];
        if (!byteCode) {
          return Promise.resolve(null);
        }
        return Promise.any([
          this.contractHelper.detectProxyContractByByteCode(
            addr,
            byteCode,
            EIPProxyContractSupportByteCode.EIP_1967_IMPLEMENTATION.SLOT
          ),
          this.contractHelper.detectProxyContractByByteCode(
            addr,
            byteCode,
            EIPProxyContractSupportByteCode.EIP_1822_IMPLEMENTATION.SLOT
          ),
          this.contractHelper.detectProxyContractByByteCode(
            addr,
            byteCode,
            EIPProxyContractSupportByteCode.OPEN_ZEPPELIN_IMPLEMENTATION.SLOT
          ),
          this.contractHelper.detectProxyContractByByteCode(
            addr,
            byteCode,
            EIPProxyContractSupportByteCode.EIP_1167_IMPLEMENTATION.SLOT
          ),
          this.contractHelper.detectBeaconProxyContract(
            beaconContracts.find((e) => e.address === addr)?.beacon
          ),
        ]).catch(() => Promise.resolve(null));
      })
    );
    addrs.forEach((addr, index) => {
      result[addr] = proxiesInfo[index];
    });
    return result;
  }

  async getBytecodeContracts(
    addresses: string[]
  ): Promise<_.Dictionary<GetBytecodeReturnType>> {
    const codesByAddress: Dictionary<GetBytecodeReturnType> = {};
    const codes = await Promise.all(
      addresses.map((address) =>
        this.viemClient.getBytecode({
          address: address as `0x${string}`,
        })
      )
    );
    addresses.forEach((address, index) => {
      codesByAddress[address] = codes[index];
    });
    return codesByAddress;
  }

  detectContractTypeByCode(code: string): string | null {
    const selectors = whatsabi
      .selectorsFromBytecode(code)
      .map((selector) => selector.slice(2, 10));
    if (
      EVM_CONTRACT_METHOD_HEX_PREFIX.ABI_INTERFACE_ERC20.every((method) =>
        selectors.includes(method)
      )
    ) {
      return EVMSmartContract.TYPES.ERC20;
    }
    if (
      EVM_CONTRACT_METHOD_HEX_PREFIX.ABI_INTERFACE_ERC721.every((method) =>
        selectors.includes(method)
      )
    ) {
      return EVMSmartContract.TYPES.ERC721;
    }
    if (
      EVM_CONTRACT_METHOD_HEX_PREFIX.ABI_INTERFACE_ERC1155.every((method) =>
        selectors.includes(method)
      )
    ) {
      return EVMSmartContract.TYPES.ERC1155;
    }
    return null;
  }

  public async _start(): Promise<void> {
    this.viemClient = getViemClient();
    this.contractHelper = new ContractHelper(this.viemClient);
    await this.createJob(
      BULL_JOB_NAME.CRAWL_SMART_CONTRACT_EVM,
      BULL_JOB_NAME.CRAWL_SMART_CONTRACT_EVM,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlSmartContractEVM.millisecondCrawl,
        },
      }
    );
    await this.createJob(
      BULL_JOB_NAME.HANDLE_SELF_DESTRUCT,
      BULL_JOB_NAME.HANDLE_SELF_DESTRUCT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlSmartContractEVM.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
