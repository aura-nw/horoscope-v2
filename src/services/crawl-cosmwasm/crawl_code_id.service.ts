/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import Long from 'long';
import {
  QueryCodeRequest,
  QueryCodeResponse,
} from '@aura-nw/aurajs/types/codegen/cosmwasm/wasm/v1/query';
import { fromBase64, toHex } from '@cosmjs/encoding';
import { cosmwasm } from '@aura-nw/aurajs';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import {
  Block,
  BlockCheckpoint,
  CodeId,
  Event,
  EventAttribute,
  Transaction,
} from '../../models';
import {
  ABCI_QUERY_PATH,
  BULL_JOB_NAME,
  SERVICE,
  getHttpBatchClient,
} from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';

@Service({
  name: SERVICE.V1.CrawlCodeIdService.key,
  version: 1,
})
export default class CrawlCodeIdService extends BullableService {
  private _httpBatchClient: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_CODE_ID,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const batchQueries: any[] = [];

    const [crawlCidBlkChk, latestBlock]: [
      BlockCheckpoint | undefined,
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.CRAWL_CODE_ID),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);

    let lastHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (crawlCidBlkChk) {
      lastHeight = crawlCidBlkChk.height;
      updateBlockCheckpoint = crawlCidBlkChk;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.CRAWL_CODE_ID,
        height: 0,
      });

    if (latestBlock) {
      if (latestBlock.height === lastHeight) return;

      const codeIds: {
        hash: string;
        height: number;
        codeId: Long;
      }[] = [];
      let offset = 0;
      let done = false;
      while (!done) {
        const resultTx = await Transaction.query()
          .joinRelated('events.[attributes]')
          .where('transaction.height', '>', lastHeight)
          .andWhere('transaction.height', '<=', latestBlock.height)
          .andWhere('transaction.code', 0)
          .andWhere('events.type', Event.EVENT_TYPE.STORE_CODE)
          .andWhere(
            'events:attributes.key',
            EventAttribute.ATTRIBUTE_KEY.CODE_ID
          )
          .select(
            'transaction.hash',
            'transaction.height',
            'events:attributes.key',
            'events:attributes.value'
          )
          .page(offset, 100);
        this.logger.info(
          `Result get Tx from height ${lastHeight} to ${latestBlock.height}:`
        );
        this.logger.info(JSON.stringify(resultTx));

        if (resultTx.results.length > 0)
          resultTx.results.map((res: any) =>
            codeIds.push({
              hash: res.hash,
              height: res.height,
              codeId: Long.fromString(res.value),
            })
          );

        if (resultTx.results.length === 100) offset += 1;
        else done = true;
      }

      if (codeIds.length > 0) {
        codeIds.forEach((code) => {
          const request: QueryCodeRequest = {
            codeId: code.codeId,
          };
          const data = toHex(
            cosmwasm.wasm.v1.QueryCodeRequest.encode(request).finish()
          );

          batchQueries.push(
            this._httpBatchClient.execute(
              createJsonRpcRequest('abci_query', {
                path: ABCI_QUERY_PATH.CODE,
                data,
              })
            )
          );
        });

        const result: JsonRpcSuccessResponse[] = await Promise.all(
          batchQueries
        );
        const onchainCodeIds: QueryCodeResponse[] = result.map(
          (res: JsonRpcSuccessResponse) =>
            cosmwasm.wasm.v1.QueryCodeResponse.decode(
              fromBase64(res.result.response.value)
            )
        );

        const codeIdEntities = onchainCodeIds.map((code, index) =>
          CodeId.fromJson({
            code_id: codeIds[index].codeId,
            creator: code.codeInfo?.creator,
            data_hash: code.codeInfo?.dataHash,
            instantiate_permission: code.codeInfo?.instantiatePermission,
            type: null,
            status: null,
            store_hash: codeIds[index].hash,
            store_height: codeIds[index].height,
          })
        );

        await CodeId.query()
          .insert(codeIdEntities)
          .onConflict('code_id')
          .merge()
          .returning('code_id')
          .catch((error) => {
            this.logger.error('Error insert or update code ids');
            this.logger.error(error);
          });
      }

      updateBlockCheckpoint.height = latestBlock.height;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id');
    }
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_CODE_ID,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlCodeId.millisecondCrawl,
        },
      }
    );

    return super._start();
  }
}
