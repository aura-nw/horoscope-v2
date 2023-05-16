/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { getContractActivities } from '../../common/utils/smart_contract';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BULL_JOB_NAME,
  Config,
  SERVICE,
  getHttpBatchClient,
} from '../../common';
import { Block, BlockCheckpoint } from '../../models';

const { NODE_ENV } = Config;
@Service({
  name: SERVICE.V1.CrawlSmartContractService.CrawlContractEventService.key,
  version: 1,
})
export default class CrawlCodeService extends BullableService {
  _blocksPerBatch!: number;

  _currentAssetHandlerBlock!: number;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_CONTRACT_EVENT,
    jobType: BULL_JOB_NAME.CRAWL_CONTRACT_EVENT,
  })
  async jobHandler(): Promise<void> {
    if (this._currentAssetHandlerBlock) {
      // get range txs for proccessing
      const startBlock: number = this._currentAssetHandlerBlock;
      const latestBlock = await Block.query()
        .limit(1)
        .orderBy('height', 'DESC')
        .first()
        .throwIfNotFound();
      const endBlock: number = Math.min(
        startBlock + this._blocksPerBatch,
        latestBlock.height
      );
      this.logger.info(`startBlock: ${startBlock} to endBlock: ${endBlock}`);
      if (endBlock >= startBlock) {
        try {
          // get all contract Msg in above range blocks
          const listContractMsg = await getContractActivities(
            startBlock,
            endBlock
          );
          this.logger.debug(listContractMsg);
        } catch (error) {
          this.logger.error(error);
        }
      }
    }
  }

  // init enviroment variable before start service
  async initEnv() {
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
    this._currentAssetHandlerBlock = blockCheckpoint.height;
    this.logger.info(
      `_currentAssetHandlerBlock: ${this._currentAssetHandlerBlock}`
    );
  }

  async _start(): Promise<void> {
    this._httpBatchClient = getHttpBatchClient();
    this._blocksPerBatch = config.crawlContractEvent.blocksPerBatch
      ? config.crawlContractEvent.blocksPerBatch
      : 100;
    if (NODE_ENV !== 'test') {
      await this.initEnv();
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
