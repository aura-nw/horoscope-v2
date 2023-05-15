/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import {
  QueryContractInfoRequest,
  QueryContractInfoResponse,
  QueryRawContractStateRequest,
  QueryRawContractStateResponse,
} from '@aura-nw/aurajs/types/codegen/cosmwasm/wasm/v1/query';
import { fromBase64, fromUtf8, toHex } from '@cosmjs/encoding';
import { cosmwasm } from '@aura-nw/aurajs';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import _ from 'lodash';
import Long from 'long';
import knex from '../../common/utils/db_connection';
import {
  BlockCheckpoint,
  Event,
  Transaction,
  EventAttribute,
  SmartContract,
  Code,
} from '../../models';
import {
  ABCI_QUERY_PATH,
  BULL_JOB_NAME,
  getHttpBatchClient,
  IStoreCodes,
  SERVICE,
} from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';

@Service({
  name: SERVICE.V1.CrawlSmartContractService.key,
  version: 1,
})
export default class CrawlSmartContractService extends BullableService {
  private _httpBatchClient: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_SMART_CONTRACT,
    jobType: 'crawl',
    prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const queryAddresses: string[] = [];
    const smartContracts: SmartContract[] = [];

    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_SMART_CONTRACT,
        BULL_JOB_NAME.CRAWL_CODE,
        config.crawlCodeId.key
      );
    this.logger.info(`startHeight: ${startHeight}, endHeight: ${endHeight}`);
    if (startHeight >= endHeight) return;

    const instantiateTxs: any[] = [];
    const resultTx = await Transaction.query()
      .joinRelated('events.[attributes]')
      .where('events.type', Event.EVENT_TYPE.INSTANTIATE)
      .andWhere(
        'events:attributes.key',
        EventAttribute.ATTRIBUTE_KEY._CONTRACT_ADDRESS
      )
      .andWhere('transaction.height', '>', startHeight)
      .andWhere('transaction.height', '<=', endHeight)
      .andWhere('transaction.code', 0)
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
      resultTx.map((res: any) => instantiateTxs.push(res));

    await knex
      .transaction(async (trx) => {
        if (instantiateTxs.length > 0) {
          instantiateTxs.forEach((transaction) => {
            queryAddresses.push(transaction.value);
            smartContracts.push(
              SmartContract.fromJson({
                name: null,
                address: transaction.value,
                creator: '',
                code_id: 0,
                instantiate_hash: transaction.hash,
                instantiate_height: transaction.height,
                version: null,
              })
            );
          });

          const [contractCw2s, contractInfos] = await this.getContractInfo(
            queryAddresses
          );

          const codeIds: number[] = [];
          smartContracts.forEach((contract, index) => {
            if (contractCw2s[index]?.data) {
              const data = JSON.parse(
                fromUtf8(contractCw2s[index]?.data || new Uint8Array())
              );
              contract.name = data.contract;
              contract.version = data.version;
            }
            if (contractInfos[index]?.contractInfo) {
              contract.code_id = parseInt(
                contractInfos[index]?.contractInfo?.codeId.toString() || '0',
                10
              );
              contract.creator =
                contractInfos[index]?.contractInfo?.creator || '';

              codeIds.push(
                parseInt(
                  contractInfos[index]?.contractInfo?.codeId.toString() || '0',
                  10
                )
              );
            }
          });

          const codes: Code[] = await Code.query().whereIn('code_id', codeIds);
          const codeKeys = _.keyBy(codes, 'code_id');
          const missingCodeIds: IStoreCodes[] = [];
          codeIds.forEach((codeId) => {
            if (!codeKeys[codeId])
              missingCodeIds.push({
                codeId: Long.fromInt(codeId),
                hash: '',
                height: 0,
              });
          });
          if (missingCodeIds.length > 0)
            await this.broker.call(
              SERVICE.V1.CrawlCodeService.CrawlMissingCode.path,
              { codeIds: missingCodeIds }
            );

          if (smartContracts.length > 0)
            await SmartContract.query()
              .insert(smartContracts)
              .onConflict('address')
              .merge()
              .returning('address')
              .transacting(trx)
              .catch((error) => {
                this.logger.error('Error insert new smart contracts');
                this.logger.error(error);
              });
        }

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

  private async getContractInfo(
    addresses: string[]
  ): Promise<
    [
      (QueryRawContractStateResponse | null)[],
      (QueryContractInfoResponse | null)[]
    ]
  > {
    const batchQueries: any[] = [];

    addresses.forEach((address) => {
      const requestCw2: QueryRawContractStateRequest = {
        address,
        queryData: fromBase64('Y29udHJhY3RfaW5mbw=='), // contract_info
      };
      const dataCw2 = toHex(
        cosmwasm.wasm.v1.QueryRawContractStateRequest.encode(
          requestCw2
        ).finish()
      );

      const requestContractInfo: QueryContractInfoRequest = {
        address,
      };
      const dataContractInfo = toHex(
        cosmwasm.wasm.v1.QueryContractInfoRequest.encode(
          requestContractInfo
        ).finish()
      );

      batchQueries.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: ABCI_QUERY_PATH.RAW_CONTRACT_STATE,
            data: dataCw2,
          })
        ),
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: ABCI_QUERY_PATH.CONTRACT_INFO,
            data: dataContractInfo,
          })
        )
      );
    });

    const results: JsonRpcSuccessResponse[] = await Promise.all(batchQueries);

    const contractCw2s: any[] = [];
    const contractInfos: any[] = [];
    for (let i = 0; i < results.length; i += 2) {
      contractCw2s.push(
        results[i].result.response.value
          ? cosmwasm.wasm.v1.QueryRawContractStateResponse.decode(
              fromBase64(results[i].result.response.value)
            )
          : null
      );
      contractInfos.push(
        results[i + 1].result.response.value
          ? cosmwasm.wasm.v1.QueryContractInfoResponse.decode(
              fromBase64(results[i + 1].result.response.value)
            )
          : null
      );
    }

    return [contractCw2s, contractInfos];
  }

  public async _start() {
    await this.broker.waitForServices(SERVICE.V1.CrawlCodeService.name);

    this.createJob(
      BULL_JOB_NAME.CRAWL_SMART_CONTRACT,
      'crawl',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlSmartContract.millisecondCrawl,
        },
        attempts: config.jobRetryAttempt,
        backoff: config.jobRetryBackoff,
      }
    );

    return super._start();
  }
}
