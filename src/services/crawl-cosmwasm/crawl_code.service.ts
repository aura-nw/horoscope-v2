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
  Code,
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
  name: SERVICE.V1.CrawlCodeService.key,
  version: 1,
})
export default class CrawlCodeService extends BullableService {
  private _httpBatchClient: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_CODE,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const batchQueries: any[] = [];

    const [codeIdCheckpoint, latestBlock]: [
      BlockCheckpoint | undefined,
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.CRAWL_CODE),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);

    let startHeight = 0;
    let endHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (codeIdCheckpoint) {
      startHeight = codeIdCheckpoint.height;
      updateBlockCheckpoint = codeIdCheckpoint;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.CRAWL_CODE,
        height: 0,
      });

    if (latestBlock) {
      if (latestBlock.height === startHeight) return;
      endHeight = Math.min(
        startHeight + config.crawlCodeId.blocksPerCall,
        latestBlock.height - 1
      );

      const codeIds: {
        hash: string;
        height: number;
        codeId: Long;
      }[] = [];
      this.logger.info(`Query Tx from height ${startHeight} to ${endHeight}`);

      const resultTx = await Transaction.query()
        .joinRelated('events.[attributes]')
        .where('transaction.height', '>', startHeight)
        .andWhere('transaction.height', '<=', endHeight)
        .andWhere('transaction.code', 0)
        .andWhere('events.type', Event.EVENT_TYPE.STORE_CODE)
        .andWhere('events:attributes.key', EventAttribute.ATTRIBUTE_KEY.CODE_ID)
        .select(
          'transaction.hash',
          'transaction.height',
          'events:attributes.key',
          'events:attributes.value'
        );
      this.logger.info(
        `Result get Tx from height ${startHeight} to ${endHeight}:`
      );
      this.logger.info(JSON.stringify(resultTx));

      if (resultTx.length > 0)
        resultTx.map((res: any) =>
          codeIds.push({
            hash: res.hash,
            height: res.height,
            codeId: Long.fromString(res.value),
          })
        );

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

        const codeEntities = onchainCodeIds.map((code, index) =>
          Code.fromJson({
            code_id: parseInt(codeIds[index].codeId.toString(), 10),
            creator: code.codeInfo?.creator,
            data_hash: toHex(
              code.codeInfo?.dataHash || new Uint8Array()
            ).toLowerCase(),
            instantiate_permission: code.codeInfo?.instantiatePermission,
            type: null,
            status: null,
            store_hash: codeIds[index].hash,
            store_height: codeIds[index].height,
          })
        );

        await Code.query()
          .insert(codeEntities)
          .onConflict('code_id')
          .merge()
          .returning('code_id')
          .catch((error) => {
            this.logger.error('Error insert or update code ids');
            this.logger.error(error);
          });
      }

      updateBlockCheckpoint.height = endHeight;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id');
    }
  }

  public async _start() {
    this.createJob(
      BULL_JOB_NAME.CRAWL_CODE,
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
