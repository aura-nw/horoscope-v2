import { ServiceBroker } from 'moleculer';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import Utils from '../../utils/utils';
import { URL_TYPE_CONSTANTS } from '../../common/constant';
import { Config } from '../../common';
import { callApiMixin } from '../../mixins/callApi/call-api.mixin';
import BullableService, { QueueHandler } from '../../base/BullableService';

@Service({
  name: 'crawl.block',
  mixins: [callApiMixin],
  version: 1,
})
export default class CrawlBlockService extends BullableService {
  private _currentBlock = 0;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this.getQueueManager().bindThis(this);
  }

  @QueueHandler({
    queueName: 'crawl.block',
    jobType: 'crawl.block',
    prefix: 'horoscope_',
  })
  private async jobHandler(_payload: any): Promise<void> {
    await this.initEnv();
    await this.handleJobCrawlBlock();
    // this.logger.info(123);
  }

  private async initEnv() {
    // Get handled block
    const handledBlockRedis = await this.broker.cacher?.get(Config.REDIS_KEY_CURRENT_BLOCK);
    this._currentBlock = 0;
    const { START_BLOCK } = Config;

    if (handledBlockRedis && typeof handledBlockRedis === 'string') {
      this._currentBlock = parseInt(handledBlockRedis, 10);
    } else if (!Number.isNaN(START_BLOCK)) {
      this._currentBlock = parseInt(START_BLOCK, 10);
    } else {
      this._currentBlock = 0;
    }
    // this._currentBlock = handledBlockRedis ? parseInt(handledBlockRedis, 10) : this._currentBlock;
    this.logger.info(`_currentBlock: ${this._currentBlock}`);
  }

  async handleJobCrawlBlock() {
    let latestBlockRedis: any = await this.broker.cacher?.get(Config.REDIS_KEY_LATEST_BLOCK);
    latestBlockRedis = parseInt(latestBlockRedis ?? '0', 10);

    const url = Utils.getUrlByChainIdAndType(Config.CHAIN_ID, URL_TYPE_CONSTANTS.RPC);
    const responseGetLatestBlock = await this.callApiFromDomain(
      url,
      `${Config.GET_LATEST_BLOCK_API}`,
    );
    const latestBlockNetwork = parseInt(responseGetLatestBlock.result.block.header.height, 10);

    if (latestBlockNetwork > latestBlockRedis) {
      await this.broker.cacher?.set(Config.REDIS_KEY_LATEST_BLOCK, latestBlockNetwork);
    }

    this.logger.info(`latestBlockNetwork: ${latestBlockNetwork}`);

    const startBlock = this._currentBlock + 1;

    let endBlock = startBlock + parseInt(Config.NUMBER_OF_BLOCK_PER_CALL, 10) - 1;
    if (endBlock > Math.max(latestBlockNetwork, latestBlockRedis)) {
      endBlock = Math.max(latestBlockNetwork, latestBlockRedis);
    }
    this.logger.info(`startBlock: ${startBlock} endBlock: ${endBlock}`);
    try {
      const listPromise = [];
      for (let i = startBlock; i <= endBlock; i += 1) {
        listPromise.push(this.callApiFromDomain(url, `${Config.GET_BLOCK_BY_HEIGHT_API}${i}`));
      }
      const resultListPromise: any[] = await Promise.all(listPromise);

      const listBlock: any = resultListPromise.map((item) => item.result);

      this.logger.info(listBlock);
      this.handleListBlock(listBlock);
      if (this._currentBlock < endBlock) {
        this._currentBlock = endBlock;
        this.broker.cacher?.set(Config.REDIS_KEY_CURRENT_BLOCK, this._currentBlock);
      }
    } catch (error) {
      this.logger.error(error);
      throw new Error('cannot crawl block');
    }
  }

  async handleListBlock(listBlock: any[]) {
    listBlock.forEach((block) => {
      this.logger.info(`create job handle block: ${block?.block?.header?.height}`);

      this.createJob(
        'handle.block',
        'handle.block',
        {
          source: block.block?.header?.height,
          block,
        },
        {
          removeOnComplete: true,
        },
      );
    });
  }

  public async _start() {
    this.createJob(
      'crawl.block',
      'crawl.block',
      {
        abc: 123,
        parent: {
          abc: 123,
        },
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: 10000,
        },
      },
    );
    return super._start();
  }
}
