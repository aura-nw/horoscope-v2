import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { ethers, keccak256 } from 'ethers';
import EtherJsClient from '../../common/utils/etherjs_client';
import {
  BlockCheckpoint,
  EVMSmartContract,
  EVMTransaction,
} from '../../models';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';
import {
  DetectEVMProxyContract,
  EIPProxyContractSupportByteCode,
  EVM_CONTRACT_METHOD_HEX_PREFIX,
  EVM_DEFAULT_SLOT_BYTE_CODE_LENGTH,
  EVM_PREFIX,
  NULL_BYTE_CODE,
  ZERO_ADDRESS,
} from './constant';

@Service({
  name: SERVICE.V1.CrawlSmartContractEVM.key,
  version: 1,
})
export default class CrawlSmartContractEVMService extends BullableService {
  etherJsClient!: ethers.AbstractProvider;

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
        [BULL_JOB_NAME.JOB_CRAWL_EVM_EVENT],
        config.crawlSmartContractEVM.key
      );
    this.logger.info(
      `Crawl EVM smart contract from block ${startBlock} to block ${endBlock}`
    );
    if (startBlock >= endBlock) {
      return;
    }

    const evmTxs = await EVMTransaction.query()
      .select(
        'evm_transaction.height',
        'evm_transaction.hash',
        'evm_transaction.from',
        'evm_transaction.to',
        'evm_transaction.contract_address',
        'evm_transaction.data'
      )
      .withGraphFetched('evm_events')
      .modifyGraph('evm_events', (builder) => {
        builder
          .select(knex.raw('ARRAY_AGG(address) as event_address'))
          .groupBy('evm_tx_id')
          .orderBy('evm_tx_id');
      })
      .where('evm_transaction.height', '>', startBlock)
      .andWhere('evm_transaction.height', '<=', endBlock)
      .orderBy('evm_transaction.id', 'ASC')
      .orderBy('evm_transaction.height', 'ASC');

    let addresses: string[] = [];
    const addressesWithTx: any = [];
    evmTxs.forEach((evmTx: any) => {
      let currentAddresses: string[] = [];
      ['from', 'to', 'contract_address'].forEach((key) => {
        if (evmTx[key] && evmTx[key].startsWith('0x')) {
          currentAddresses.push(evmTx[key]);
        }
      });

      if (
        evmTx.evm_events.length > 0 &&
        evmTx.evm_events[0].event_address.length > 0
      ) {
        currentAddresses.push(...evmTx.evm_events[0].event_address);
      }
      currentAddresses = _.uniq(currentAddresses);
      addresses.push(...currentAddresses);
      addressesWithTx[evmTx.hash] = currentAddresses;
    });

    addresses = _.uniq(addresses);

    const evmContracts: EVMSmartContract[] = [];

    const evmContractsInDB: EVMSmartContract[] = await EVMSmartContract.query()
      .select('address')
      .whereIn('address', addresses);

    const evmContractsWithAddress: any = [];
    evmContractsInDB.forEach((evmContract) => {
      evmContractsWithAddress[evmContract.address] = evmContract;
    });

    await Promise.all(
      evmTxs.map(async (evmTx) => {
        const currentAddresses = addressesWithTx[evmTx.hash];

        const notFoundAddresses = currentAddresses.filter(
          (address: string) => !evmContractsWithAddress[address]
        );

        if (notFoundAddresses.length === 0) {
          return;
        }

        await Promise.all(
          notFoundAddresses.map(async (address: string) => {
            const code = await this.etherJsClient.getCode(address);

            // check if this address has code -> is smart contract
            if (code !== '0x') {
              // check if this event belongs to smart contract creation tx
              let creator;
              let createdHeight;
              let createdHash;
              const type = this.detectContractTypeByCode(code);
              const codeHash = keccak256(code);
              if (evmTx.data) {
                const { data } = evmTx;
                if (
                  data.startsWith(
                    EVM_CONTRACT_METHOD_HEX_PREFIX.CREATE_CONTRACT
                  )
                ) {
                  creator = evmTx.from;
                  createdHeight = evmTx.height;
                  createdHash = evmTx.hash;
                }
              }
              evmContracts.push(
                EVMSmartContract.fromJson({
                  address,
                  creator,
                  type,
                  created_hash: createdHash,
                  created_height: createdHeight,
                  code_hash: codeHash,
                })
              );
            }
          })
        );
      })
    );

    await knex.transaction(async (trx) => {
      if (evmContracts.length > 0) {
        const newEvmContracts: EVMSmartContract[] = _.uniqBy(
          evmContracts,
          'address'
        );
        await EVMSmartContract.query().insert(newEvmContracts).transacting(trx);
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

  detectContractTypeByCode(code: string): string | null {
    if (
      EVM_CONTRACT_METHOD_HEX_PREFIX.ABI_INTERFACE_ERC20.every((method) =>
        code.includes(method)
      )
    ) {
      return EVMSmartContract.TYPES.ERC20;
    }
    if (
      EVM_CONTRACT_METHOD_HEX_PREFIX.ABI_INTERFACE_ERC721.every((method) =>
        code.includes(method)
      )
    ) {
      return EVMSmartContract.TYPES.ERC721;
    }
    if (
      EVM_CONTRACT_METHOD_HEX_PREFIX.ABI_INTERFACE_ERC1155.every((method) =>
        code.includes(method)
      )
    ) {
      return EVMSmartContract.TYPES.ERC1155;
    }
    return null;
  }

  public async detectProxyContractByByteCode(
    contractAddress: string,
    byteCode: string,
    byteCodeSlot: EIPProxyContractSupportByteCode
  ): Promise<DetectEVMProxyContract> {
    const resultReturn: DetectEVMProxyContract = {
      logicContractAddress: '',
      EIP: '',
    };
    const result = byteCode.includes(byteCodeSlot);

    if (!result) throw Error('Not proxy contract!');

    const storageSlotValue = await this.etherJsClient.getStorage(
      contractAddress,
      `${EVM_PREFIX}${byteCodeSlot}`,
      'latest'
    );

    if (storageSlotValue === '0x' || storageSlotValue === NULL_BYTE_CODE)
      throw Error('Invalid contract address!');

    const logicAddress =
      storageSlotValue.length === EVM_DEFAULT_SLOT_BYTE_CODE_LENGTH
        ? `${EVM_PREFIX}${storageSlotValue.slice(-40)}`
        : storageSlotValue;

    if (logicAddress === ZERO_ADDRESS) throw Error('Zero contract detected!');

    resultReturn.logicContractAddress = logicAddress;
    resultReturn.EIP = _.findKey(
      EIPProxyContractSupportByteCode,
      (val) => val === byteCodeSlot
    );
    return resultReturn;
  }

  // Detect contract is proxy contract or not
  public async isContractProxy(
    contractAddress: string
  ): Promise<DetectEVMProxyContract | null> {
    const byteCode = await this.etherJsClient.getCode(contractAddress);
    let result: DetectEVMProxyContract | null;

    try {
      result = await Promise.any([
        this.detectProxyContractByByteCode(
          contractAddress,
          byteCode,
          EIPProxyContractSupportByteCode.EIP_1967_LOGIC_SLOT
        ),
        this.detectProxyContractByByteCode(
          contractAddress,
          byteCode,
          EIPProxyContractSupportByteCode.EIP_1967_BEACON_SLOT
        ),
        this.detectProxyContractByByteCode(
          contractAddress,
          byteCode,
          EIPProxyContractSupportByteCode.EIP_1822_LOGIC_SLOT
        ),
        this.detectProxyContractByByteCode(
          contractAddress,
          byteCode,
          EIPProxyContractSupportByteCode.OPEN_ZEPPELIN_IMPLEMENTATION_SLOT
        ),
      ]);
    } catch (error) {
      result = null;
    }

    return result;
  }

  public async _start(): Promise<void> {
    this.etherJsClient = new EtherJsClient().etherJsClient;
    this.createJob(
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
    return super._start();
  }
}
