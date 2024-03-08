import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { ethers } from 'ethers';
import { fromBase64, toHex } from '@cosmjs/encoding';
import EtherJsClient from '../../common/utils/etherjs_client';
import { BlockCheckpoint, EVMSmartContract, EvmEvent } from '../../models';
import {
  BULL_JOB_NAME,
  EVM_CONTRACT_METHOD_HEX_PREFIX,
  SERVICE,
} from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

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

    const evmEvents = await EvmEvent.query()
      .withGraphFetched('evm_transaction')
      .where('block_height', '>', startBlock)
      .andWhere('block_height', '<=', endBlock)
      .orderBy('id', 'ASC')
      .orderBy('block_height', 'ASC');
    const evmContracts: EVMSmartContract[] = [];
    await Promise.all(
      evmEvents.map(async (evmEvent: any) => {
        const { address } = evmEvent;
        const code = await this.etherJsClient.getCode(address);

        // check if this address has code -> is smart contract
        if (code !== '0x') {
          // check if this event belongs to smart contract creation tx
          let creator;
          let createdHeight;
          let createdHash;
          if (evmEvent.evm_transaction.data) {
            const data = toHex(fromBase64(evmEvent.evm_transaction.data));
            if (
              data.startsWith(EVM_CONTRACT_METHOD_HEX_PREFIX.CREATE_CONTRACT)
            ) {
              creator = evmEvent.evm_transaction.from;
              createdHeight = evmEvent.block_height;
              createdHash = evmEvent.evm_transaction.hash;
            }
          }
          evmContracts.push(
            EVMSmartContract.fromJson({
              address,
              creator,
              created_hash: createdHash,
              created_height: createdHeight,
            })
          );
        }
      })
    );
    // }

    await knex.transaction(async (trx) => {
      if (evmContracts.length > 0) {
        await EVMSmartContract.query()
          .insert(evmContracts)
          .onConflict('address')
          .ignore()
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
