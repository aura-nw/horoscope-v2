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
import {
  BULL_JOB_NAME,
  SERVICE,
  EVM_CONTRACT_METHOD_HEX_PREFIX,
} from './constant';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';
import { ContractHelper } from './helpers/contract_helper';

@Service({
  name: SERVICE.V1.CrawlSmartContractEVM.key,
  version: 1,
})
export default class CrawlSmartContractEVMService extends BullableService {
  etherJsClient!: ethers.AbstractProvider;

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
              let type = this.detectContractTypeByCode(code);
              const implementContractInfo =
                await this.contractHelper.isContractProxy(address);

              if (implementContractInfo) {
                type = implementContractInfo.EIP as any;
              }

              const codeHash = keccak256(code);
              if (evmTx.data) {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                const { data, contract_address } = evmTx;
                if (
                  data.startsWith(
                    EVM_CONTRACT_METHOD_HEX_PREFIX.CREATE_CONTRACT
                  ) ||
                  contract_address
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
    let newEvmContracts: EVMSmartContract[] = [];
    await knex.transaction(async (trx) => {
      if (evmContracts.length > 0) {
        newEvmContracts = _.uniqBy(evmContracts, 'address');
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
    if (newEvmContracts.length > 0) {
      await Promise.all(
        newEvmContracts.map(async (evmContract) => {
          await this.createJob(
            BULL_JOB_NAME.INSERT_VERIFY_BY_CODEHASH,
            BULL_JOB_NAME.INSERT_VERIFY_BY_CODEHASH,
            {
              codehash: evmContract.code_hash,
            },
            {
              jobId: evmContract.code_hash,
              removeOnComplete: true,
              removeOnFail: {
                count: 3,
              },
            }
          );
        })
      );
    }
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

  public async _start(): Promise<void> {
    this.etherJsClient = new EtherJsClient().etherJsClient;
    this.contractHelper = new ContractHelper(this.etherJsClient);
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
