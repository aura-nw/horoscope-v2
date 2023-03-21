/* eslint-disable import/no-extraneous-dependencies */
import { ServiceBroker } from 'moleculer';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { GetLatestBlockResponseSDKType } from '@aura-nw/aurajs/types/codegen/cosmos/base/tendermint/v1beta1/query';
import { CommitSigSDKType } from '@aura-nw/aurajs/types/codegen/tendermint/types/types';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { BLOCK_CHECKPOINT_JOB_NAME } from '../../common/constant';
import Block from '../../models/block';
import BlockCheckpoint from '../../models/block_checkpoint';
import { Config } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { getLcdClient } from '../../common/utils/aurajs_client';
import { getHttpBatchClient } from '../../common/utils/cosmjs_client';

@Service({
  name: 'crawl.block',
  version: 1,
})
export default class CrawlBlockService extends BullableService {
  private _currentBlock = 0;

  private _httpBatchClient: HttpBatchClient;

  private _lcdClient: any;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: 'crawl.block',
    jobType: 'crawl.block',
    prefix: 'horoscope_',
  })
  private async jobHandler(_payload: any): Promise<void> {
    await this.initEnv();
    await this.handleJobCrawlBlock();
  }

  private async initEnv() {
    this._lcdClient = await getLcdClient();

    // Get handled block from db
    let blockHeightCrawled = await BlockCheckpoint.query().findOne({
      job_name: BLOCK_CHECKPOINT_JOB_NAME.BLOCK_HEIGHT_CRAWLED,
    });

    if (!blockHeightCrawled) {
      blockHeightCrawled = await BlockCheckpoint.query().insert({
        job_name: BLOCK_CHECKPOINT_JOB_NAME.BLOCK_HEIGHT_CRAWLED,
        height: parseInt(Config.START_BLOCK ?? 0, 10),
      });
    }

    this._currentBlock = blockHeightCrawled ? blockHeightCrawled.height : 0;
    this.logger.info(`_currentBlock: ${this._currentBlock}`);
  }

  async handleJobCrawlBlock() {
    // Get latest block in network
    const responseGetLatestBlock: GetLatestBlockResponseSDKType =
      await this._lcdClient.cosmos.base.tendermint.v1beta1.getLatestBlock();
    const latestBlockNetwork = parseInt(
      responseGetLatestBlock.block?.header?.height
        ? responseGetLatestBlock.block?.header?.height.toString()
        : '0',
      10
    );

    this.logger.info(`latestBlockNetwork: ${latestBlockNetwork}`);

    // crawl block from startBlock to endBlock
    const startBlock = this._currentBlock + 1;

    let endBlock =
      startBlock + parseInt(Config.NUMBER_OF_BLOCK_PER_CALL, 10) - 1;
    if (endBlock > latestBlockNetwork) {
      endBlock = latestBlockNetwork;
    }
    this.logger.info(`startBlock: ${startBlock} endBlock: ${endBlock}`);
    try {
      const listPromise = [];
      for (let i = startBlock; i <= endBlock; i += 1) {
        listPromise.push(
          this._httpBatchClient.execute(
            createJsonRpcRequest('block', { height: i.toString() })
          )
        );
      }
      const resultListPromise: JsonRpcSuccessResponse[] = await Promise.all(
        listPromise
      );

      // insert data to DB
      await this.handleListBlock(
        resultListPromise.map((result) => result.result)
      );

      // update crawled block to db
      if (this._currentBlock < endBlock) {
        await BlockCheckpoint.query()
          .update(
            BlockCheckpoint.fromJson({
              job_name: BLOCK_CHECKPOINT_JOB_NAME.BLOCK_HEIGHT_CRAWLED,
              height: endBlock,
            })
          )
          .where({
            job_name: BLOCK_CHECKPOINT_JOB_NAME.BLOCK_HEIGHT_CRAWLED,
          });
        this._currentBlock = endBlock;
      }
    } catch (error) {
      this.logger.error(error);
      throw new Error('cannot crawl block');
    }
  }

  async handleListBlock(listBlock: any[]) {
    try {
      // query list existed block and mark to a map
      const listBlockHeight: number[] = [];
      const mapExistedBlock: Map<number, boolean> = new Map();
      listBlock.forEach((block) => {
        if (block.block?.header?.height) {
          listBlockHeight.push(parseInt(block.block?.header?.height, 10));
        }
      });
      if (listBlockHeight.length) {
        const listExistedBlock = await Block.query().whereIn(
          'height',
          listBlockHeight
        );
        listExistedBlock.forEach((block) => {
          mapExistedBlock[block.height] = true;
        });
      }
      // insert list block to DB
      const listBlockModel: any[] = [];
      listBlock.forEach((block) => {
        if (
          block.block?.header?.height &&
          !mapExistedBlock[parseInt(block.block?.header?.height, 10)]
        ) {
          listBlockModel.push({
            ...Block.fromJson({
              height: block?.block?.header?.height,
              hash: block?.block_id?.hash,
              time: block?.block?.header?.time,
              proposer_address: block?.block?.header?.proposer_address,
              data: block,
            }),
            signatures: block?.block?.last_commit?.signatures.map(
              (signature: CommitSigSDKType) => ({
                block_id_flag: signature.block_id_flag,
                validator_address: signature.validator_address,
                timestamp: signature.timestamp,
                signature: signature.signature,
              })
            ),
          });
        }
      });

      if (listBlockModel.length) {
        const result: any = await Block.query().insertGraph(listBlockModel);
        this.logger.debug('result insert list block: ', result);

        // insert tx by block height
        listBlockModel.forEach(async (block) => {
          this.broker.call('v1.crawl.tx.crawlTxByHeight', {
            height: block.height,
            timestamp: block.time,
          });
        });
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  public async _start() {
    await this.waitForServices('v1.crawl.tx');
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
