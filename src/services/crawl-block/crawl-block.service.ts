import { ServiceBroker } from 'moleculer';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import Block from '../../models/block';
import BlockSignature from '../../models/block_signature';
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

  @QueueHandler({
    queueName: 'handle.block',
    jobType: 'handle.block',
    prefix: 'horoscope_',
  })
  private async handleBlock(_payload: any): Promise<void> {
    this.logger.info(JSON.stringify(_payload));
  }

  private async initEnv() {
    // Get handled block from redis
    const handledBlockRedis = await this.broker.cacher?.get(
      Config.REDIS_KEY_CURRENT_BLOCK
    );
    const { START_BLOCK } = Config;

    // read handle block from order: redis >> .env
    if (handledBlockRedis) {
      if (typeof handledBlockRedis === 'string') {
        this._currentBlock = parseInt(handledBlockRedis, 10);
      } else if (typeof handledBlockRedis === 'number') {
        this._currentBlock = handledBlockRedis;
      }
    } else if (!Number.isNaN(START_BLOCK)) {
      this._currentBlock = parseInt(START_BLOCK, 10);
    } else {
      this._currentBlock = 0;
    }
    this.logger.info(`_currentBlock: ${this._currentBlock}`);
  }

  async handleJobCrawlBlock() {
    // update latest block in redis
    let latestBlockRedis: any = await this.broker.cacher?.get(
      Config.REDIS_KEY_LATEST_BLOCK
    );
    latestBlockRedis = parseInt(latestBlockRedis ?? '0', 10);

    const url = Utils.getUrlByChainIdAndType(
      Config.CHAIN_ID,
      URL_TYPE_CONSTANTS.RPC
    );
    const responseGetLatestBlock = await this.callApiFromDomain(
      url,
      `${Config.GET_LATEST_BLOCK_API}`
    );
    const latestBlockNetwork = parseInt(
      responseGetLatestBlock.result.block.header.height,
      10
    );

    if (latestBlockNetwork > latestBlockRedis) {
      await this.broker.cacher?.set(
        Config.REDIS_KEY_LATEST_BLOCK,
        latestBlockNetwork
      );
    }

    this.logger.info(`latestBlockNetwork: ${latestBlockNetwork}`);

    // crawl block from startBlock to endBlock
    const startBlock = this._currentBlock + 1;

    let endBlock =
      startBlock + parseInt(Config.NUMBER_OF_BLOCK_PER_CALL, 10) - 1;
    if (endBlock > Math.max(latestBlockNetwork, latestBlockRedis)) {
      endBlock = Math.max(latestBlockNetwork, latestBlockRedis);
    }
    this.logger.info(`startBlock: ${startBlock} endBlock: ${endBlock}`);
    try {
      const listPromise = [];
      for (let i = startBlock; i <= endBlock; i += 1) {
        listPromise.push(
          this.callApiFromDomain(url, `${Config.GET_BLOCK_BY_HEIGHT_API}${i}`)
        );
      }
      const resultListPromise: any[] = await Promise.all(listPromise);
      const listBlock: any = resultListPromise.map((item) => item.result);
      this.logger.debug('list block from rpc: ', listBlock);

      // insert data to DB
      await this.handleListBlock(listBlock);

      // update currentBlock to redis
      if (this._currentBlock < endBlock) {
        this._currentBlock = endBlock;
        this.broker.cacher?.set(
          Config.REDIS_KEY_CURRENT_BLOCK,
          this._currentBlock
        );
      }
    } catch (error) {
      this.logger.error(error);
      throw new Error('cannot crawl block');
    }
  }

  async handleListBlock(listBlock: any[]) {
    try {
      // insert list block to DB
      const listBlockModel = listBlock.map((block) =>
        Block.fromJson({
          height: block.block.header.height,
          hash: block.block_id.hash,
          time: block.block.header.time,
          proposer_address: block.block.header.proposer_address,
          data: block,
        })
      );

      let result: any = await Block.query().insert(listBlockModel);
      this.logger.debug('result insert list block: ', result);

      // insert list signatures to DB
      const listSignatures: any[] = [];
      listBlock.forEach((block) => {
        block.block.last_commit.signatures.forEach((signature: any) => {
          listSignatures.push(
            BlockSignature.fromJson({
              height: block.block.header.height,
              block_id_flag: signature.block_id_flag,
              validator_address: signature.validator_address,
              timestamp: signature.timestamp,
              signature: signature.signature,
            })
          );
        });
      });
      result = await BlockSignature.query().insert(listSignatures);
      this.logger.debug('result insert list signatures: ', result);
    } catch (error) {
      this.logger.error(error);
    }
  }

  public async _start() {
    this.createJob(
      'crawl.block',
      'crawl.block',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: Config.MILISECOND_CRAWL_BLOCK ?? 5000,
        },
      }
    );
    return super._start();
  }
}
