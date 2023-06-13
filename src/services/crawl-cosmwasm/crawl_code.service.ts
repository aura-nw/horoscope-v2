/* eslint-disable import/no-extraneous-dependencies */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
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
import { Knex } from 'knex';
import _ from 'lodash';
import {
  BlockCheckpoint,
  Code,
  CodeIdVerification,
  Event,
  EventAttribute,
  Transaction,
} from '../../models';
import {
  ABCI_QUERY_PATH,
  BULL_JOB_NAME,
  IContextStoreCodes,
  IStoreCodes,
  SERVICE,
  getHttpBatchClient,
} from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import knex from '../../common/utils/db_connection';

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

  @Action({
    name: SERVICE.V1.CrawlCodeService.CrawlMissingCode.key,
    params: {
      codeIds: 'any[]',
    },
  })
  private async actionCrawlMissingCode(ctx: Context<IContextStoreCodes>) {
    await knex.transaction(async (trx) => {
      await this.insertNewCodes(ctx.params.codeIds, trx);
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_CODE,
    jobName: BULL_JOB_NAME.CRAWL_CODE,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_CODE,
        [BULL_JOB_NAME.HANDLE_TRANSACTION],
        config.crawlCodeId.key
      );
    this.logger.info(`startHeight: ${startHeight}, endHeight: ${endHeight}`);
    if (startHeight >= endHeight) return;

    const codeIds: IStoreCodes[] = [];

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

    if (resultTx.length > 0)
      resultTx.map((res: any) =>
        codeIds.push({
          hash: res.hash,
          height: res.height,
          codeId: Long.fromString(res.value),
        })
      );

    await knex
      .transaction(async (trx) => {
        await this.insertNewCodes(codeIds, trx);

        updateBlockCheckpoint.height = endHeight;
        await BlockCheckpoint.query()
          .insert(updateBlockCheckpoint)
          .onConflict('job_name')
          .merge()
          .returning('id')
          .transacting(trx);
      })
      .catch((error) => {
        this.logger.error(error);
        throw error;
      });
  }

  private async insertNewCodes(codeIds: IStoreCodes[], trx: Knex.Transaction) {
    const batchQueries: any[] = [];

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

      const result: JsonRpcSuccessResponse[] = await Promise.all(batchQueries);
      const onchainCodeIds: QueryCodeResponse[] = result.map(
        (res: JsonRpcSuccessResponse) =>
          cosmwasm.wasm.v1.QueryCodeResponse.decode(
            fromBase64(res.result.response.value)
          )
      );

      // Need an array of data hashes to check for verification status of code ids
      let dataHashes: string[] = [];

      const codeEntities = onchainCodeIds.map((code, index) => {
        const dataHash = toHex(
          code.codeInfo?.dataHash || new Uint8Array()
        ).toLowerCase();
        dataHashes.push(dataHash);
        return Code.fromJson({
          code_id: parseInt(codeIds[index].codeId.toString(), 10),
          creator: code.codeInfo?.creator,
          data_hash: dataHash,
          instantiate_permission: code.codeInfo?.instantiatePermission,
          type: null,
          status: null,
          store_hash: codeIds[index].hash,
          store_height: codeIds[index].height,
        });
      });

      dataHashes = Array.from(new Set(dataHashes));
      const codeIdVerifications = await CodeIdVerification.query()
        .whereIn('data_hash', dataHashes)
        .andWhere(
          'verification_status',
          CodeIdVerification.VERIFICATION_STATUS.SUCCESS
        );

      const newVerifications: CodeIdVerification[] = [];
      codeIdVerifications.forEach((verification) => {
        const codes = codeEntities.filter(
          (code) => code.data_hash === verification.data_hash
        );
        const omitVerification = _.omit(verification, [
          'id',
          'created_at',
          'updated_at',
        ]);
        if (codes.length > 0) {
          newVerifications.push(
            ...codes.map((code) =>
              CodeIdVerification.fromJson({
                ...omitVerification,
                code_id: code.code_id,
                verified_at: new Date().toISOString(),
              })
            )
          );
        }
      });

      if (codeEntities.length > 0)
        await Code.query()
          .insert(codeEntities)
          .onConflict('code_id')
          .merge()
          .returning('code_id')
          .transacting(trx)
          .catch((error) => {
            this.logger.error(
              `Error insert or update code ids: ${JSON.stringify(codeEntities)}`
            );
            this.logger.error(error);
          });

      if (newVerifications.length > 0)
        await CodeIdVerification.query()
          .insert(newVerifications)
          .transacting(trx)
          .catch((error) => {
            this.logger.error('Error insert code id verifications');
            this.logger.error(error);
          });
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
