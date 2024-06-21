import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import _, { Dictionary } from 'lodash';
import { ServiceBroker } from 'moleculer';
import { whatsabi } from '@shazow/whatsabi';
import { PublicClient, keccak256 } from 'viem';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import knex from '../../common/utils/db_connection';
import { getViemClient } from '../../common/utils/etherjs_client';
import {
  BlockCheckpoint,
  EVMSmartContract,
  EVMTransaction,
  EvmInternalTransaction,
} from '../../models';
import {
  BULL_JOB_NAME,
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

    const evmTxs = await EVMTransaction.query()
      .select(
        'evm_transaction.height',
        'evm_transaction.hash',
        'evm_transaction.from',
        'evm_transaction.to',
        'evm_transaction.contract_address',
        'evm_transaction.data'
      )
      .withGraphFetched('[evm_events, evm_internal_transactions]')
      .modifyGraph('evm_events', (builder) => {
        builder
          .select(knex.raw('ARRAY_AGG(address) as event_address'))
          .groupBy('evm_tx_id')
          .orderBy('evm_tx_id');
      })
      .modifyGraph('evm_internal_transactions', (builder) => {
        builder
          .select('to')
          .whereIn('type', [
            EvmInternalTransaction.TYPE.CREATE,
            EvmInternalTransaction.TYPE.CREATE2,
          ]);
      })
      .where('evm_transaction.height', '>', startBlock)
      .andWhere('evm_transaction.height', '<=', endBlock)
      .orderBy('evm_transaction.id', 'ASC')
      .orderBy('evm_transaction.height', 'ASC');

    let addresses: string[] = [];
    const addressesWithTx: Dictionary<string[]> = {};
    const isCreationInternalContracts: Dictionary<boolean> = {};
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
      evmTx.evm_internal_transactions.forEach(
        (creationInternalTx: EvmInternalTransaction) => {
          currentAddresses.push(creationInternalTx.to);
          isCreationInternalContracts[creationInternalTx.to] = true;
        }
      );
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
            const code = await this.viemClient.getBytecode({
              address: address as `0x${string}`,
            });
            // check if this address has code -> is smart contract
            if (code) {
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
                  contract_address ||
                  isCreationInternalContracts[address]
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
