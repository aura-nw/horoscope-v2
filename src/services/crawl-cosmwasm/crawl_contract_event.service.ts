/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { SmartContractEvent } from '../../models/smart_contract_event';
import knex from '../../common/utils/db_connection';
import { getContractActivities } from '../../common/utils/smart_contract';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  Config,
  SERVICE,
  getHttpBatchClient,
} from '../../common';
import { Block, BlockCheckpoint, SmartContract } from '../../models';

const { NODE_ENV } = Config;
@Service({
  name: SERVICE.V1.CrawlSmartContractService.CrawlContractEventService.key,
  version: 1,
})
export default class CrawlCodeService extends BullableService {
  _blocksPerBatch!: number;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_CONTRACT_EVENT,
    jobName: BULL_JOB_NAME.CRAWL_CONTRACT_EVENT,
  })
  async jobHandler(): Promise<void> {
    // get range txs for proccessing
    const [startBlock, endBlock] = await this.getRangeProcessing();
    this.logger.info(`startBlock: ${startBlock} to endBlock: ${endBlock}`);
    if (endBlock >= startBlock) {
      try {
        // get all contract event in above range blocks
        const contractEvents = await getContractActivities(
          startBlock,
          endBlock
        );
        const contractByAddress = await this.getContractByAddress(
          contractEvents.map((contractEvent) => contractEvent.contractAddress)
        );
        await knex.transaction(async (trx) => {
          const queries: any[] = [];
          contractEvents.forEach((contractEvent) => {
            this.logger.debug({
              contractAddress: contractEvent.contractAddress,
              action: contractEvent.action,
              event_id: contractEvent.event_id,
              index: contractEvent.index,
            });
            const smartContractId =
              contractByAddress[contractEvent.contractAddress].id;
            const query = SmartContractEvent.query()
              .insertGraph({
                ...SmartContractEvent.fromJson({
                  smart_contract_id: smartContractId,
                  action: contractEvent.action,
                  event_id: contractEvent.event_id,
                  index: contractEvent.index,
                }),
                attributes: contractEvent.wasm_attributes,
              })
              .transacting(trx);
            queries.push(query);
          });
          queries.push(
            BlockCheckpoint.query()
              .patch({
                height: endBlock + 1,
              })
              .where('job_name', BULL_JOB_NAME.CRAWL_CONTRACT_EVENT)
          );
          await Promise.all(queries) // Once every query is written
            .then(trx.commit) // Try to execute all of them
            .catch(trx.rollback); // And rollback in case any of them goes wrong
        });
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  // from list contract addresses, get those appopriate records in DB, key by its contract_address
  async getContractByAddress(addresses: string[]) {
    const smartContractRecords = await SmartContract.query()
      .whereIn('smart_contract.address', addresses)
      .select('id', 'address');
    return _.keyBy(smartContractRecords, (contract) => contract.address);
  }

  // get range txs for proccessing
  async getRangeProcessing() {
    // DB -> Config -> MinDB
    // Get handled blocks from db
    let blockCheckpoint = await BlockCheckpoint.query().findOne({
      job_name: BULL_JOB_NAME.CRAWL_CONTRACT_EVENT,
    });
    if (!blockCheckpoint) {
      // min Tx from DB
      const minBlock = await Block.query()
        .limit(1)
        .orderBy('height', 'ASC')
        .first()
        .throwIfNotFound();
      blockCheckpoint = await BlockCheckpoint.query().insert({
        job_name: BULL_JOB_NAME.CRAWL_CONTRACT_EVENT,
        height: config.crawlContractEvent.startBlock
          ? config.crawlContractEvent.startBlock
          : minBlock.height,
      });
    }
    const startBlock: number = blockCheckpoint.height;
    const latestBlock = await Block.query()
      .limit(1)
      .orderBy('height', 'DESC')
      .first()
      .throwIfNotFound();
    const endBlock: number = Math.min(
      startBlock + this._blocksPerBatch,
      latestBlock.height
    );
    return [startBlock, endBlock];
  }

  async _start(): Promise<void> {
    this._httpBatchClient = getHttpBatchClient();
    this._blocksPerBatch = config.crawlContractEvent.blocksPerBatch
      ? config.crawlContractEvent.blocksPerBatch
      : 100;
    if (NODE_ENV !== 'test') {
      await this.createJob(
        BULL_JOB_NAME.CRAWL_CONTRACT_EVENT,
        BULL_JOB_NAME.CRAWL_CONTRACT_EVENT,
        {},
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.crawlContractEvent.millisecondRepeatJob,
          },
        }
      );
    }
    return super._start();
  }
}
