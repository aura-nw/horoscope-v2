/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { QueryRawContractStateRequest } from '@aura-nw/aurajs/types/codegen/cosmwasm/wasm/v1/query';
import { fromBase64, fromUtf8, toHex } from '@cosmjs/encoding';
import { cosmwasm } from '@aura-nw/aurajs';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import {
  Block,
  BlockCheckpoint,
  Event,
  Transaction,
  EventAttribute,
  SmartContract,
} from '../../models';
import {
  ABCI_QUERY_PATH,
  BULL_JOB_NAME,
  getHttpBatchClient,
  getLcdClient,
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
    this._lcdClient = await getLcdClient();

    const queryAddresses: string[] = [];
    const smartContracts: SmartContract[] = [];

    const [crawlContractBlkChk, latestBlock]: [
      BlockCheckpoint | undefined,
      Block | undefined
    ] = await Promise.all([
      BlockCheckpoint.query()
        .select('*')
        .findOne('job_name', BULL_JOB_NAME.CRAWL_SMART_CONTRACT),
      Block.query().select('height').findOne({}).orderBy('height', 'desc'),
    ]);

    let lastHeight = 0;
    let updateBlockCheckpoint: BlockCheckpoint;
    if (crawlContractBlkChk) {
      lastHeight = crawlContractBlkChk.height;
      updateBlockCheckpoint = crawlContractBlkChk;
    } else
      updateBlockCheckpoint = BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.CRAWL_SMART_CONTRACT,
        height: 0,
      });

    if (latestBlock) {
      if (latestBlock.height === lastHeight) return;

      const instantiateTxs: Transaction[] = [];
      let offset = 0;
      let done = false;
      while (!done) {
        // eslint-disable-next-line no-await-in-loop
        const resultTx = await Transaction.query()
          .joinRelated('events.[attributes]')
          .where('transaction.height', '>', lastHeight)
          .andWhere('transaction.height', '<=', latestBlock.height)
          .andWhere('transaction.code', 0)
          .andWhere((builder) =>
            builder
              .where('events.type', Event.EVENT_TYPE.MESSAGE)
              .orWhere('events.type', Event.EVENT_TYPE.INSTANTIATE)
              .orWhere('events.type', Event.EVENT_TYPE.EXECUTE)
          )
          .select('transaction.hash', 'transaction.height', 'transaction.data')
          .page(offset, 100);
        this.logger.info(
          `Result get Tx from height ${lastHeight} to ${latestBlock.height}:`
        );
        this.logger.info(JSON.stringify(resultTx));

        if (resultTx.results.length > 0)
          resultTx.results.map((res: any) => instantiateTxs.push(res));

        if (resultTx.results.length === 100) offset += 1;
        else done = true;
      }

      if (instantiateTxs.length > 0) {
        instantiateTxs.forEach((transaction) => {
          transaction.data.tx_response.logs
            .filter((log: any) =>
              log.events.find(
                (event: any) => event.type === Event.EVENT_TYPE.INSTANTIATE
              )
            )
            .forEach((log: any) => {
              const instantiateHeight = transaction.height;
              const instantiateHash = transaction.hash;
              const creator =
                log.events // Msg Instantiate Contract
                  .find((event: any) => event.type === Event.EVENT_TYPE.MESSAGE)
                  .attributes.find(
                    (attr: any) =>
                      attr.key === EventAttribute.ATTRIBUTE_KEY.SENDER
                  ).value ||
                log.events // Msg Execute Contract
                  .find((event: any) => event.type === Event.EVENT_TYPE.EXECUTE)
                  .attributes.find(
                    (attr: any) =>
                      attr.key ===
                      EventAttribute.ATTRIBUTE_KEY._CONTRACT_ADDRESS
                  ).value;

              let contractAddresses: string[];
              let codeIds: string[];
              try {
                contractAddresses = log.events
                  .find(
                    (event: any) => event.type === Event.EVENT_TYPE.INSTANTIATE
                  )
                  .attributes.filter(
                    (attr: any) =>
                      attr.key ===
                      EventAttribute.ATTRIBUTE_KEY._CONTRACT_ADDRESS
                  );
                codeIds = log.events
                  .find(
                    (event: any) => event.type === Event.EVENT_TYPE.INSTANTIATE
                  )
                  .attributes.filter(
                    (attr: any) =>
                      attr.key === EventAttribute.ATTRIBUTE_KEY.CODE_ID
                  );

                queryAddresses.push(...contractAddresses);
                contractAddresses.forEach((address, index) => {
                  smartContracts.push(
                    SmartContract.fromJson({
                      name: null,
                      address,
                      creator,
                      code_id: parseInt(codeIds[index], 10),
                      instantiate_hash: instantiateHash,
                      instantiate_height: instantiateHeight,
                      version: null,
                    })
                  );
                });
              } catch (error) {
                this.logger.error(
                  `Error get attributes at TxHash ${instantiateHash}`
                );
              }
            });
        });

        const contractInfos = await this.getContractInfo(queryAddresses);
        smartContracts.forEach((contract, index) => {
          if (contractInfos[index]?.data) {
            const data = JSON.parse(
              fromUtf8(contractInfos[index]?.data || new Uint8Array())
            );
            contract.name = data.contract;
            contract.version = data.version;
          }
        });

        await SmartContract.query()
          .insert(smartContracts)
          .onConflict('address')
          .merge()
          .returning('address')
          .catch((error) => {
            this.logger.error('Error insert new smart contracts');
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

  private async getContractInfo(addresses: string[]) {
    const batchQueriesCw2: any[] = [];

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

      batchQueriesCw2.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('abci_query', {
            path: ABCI_QUERY_PATH.RAW_CONTRACT_STATE,
            data: dataCw2,
          })
        )
      );
    });

    const resultCw2: JsonRpcSuccessResponse[] = await Promise.all(
      batchQueriesCw2
    );
    return resultCw2.map((res: JsonRpcSuccessResponse) =>
      res.result.response.value
        ? cosmwasm.wasm.v1.QueryRawContractStateResponse.decode(
            fromBase64(res.result.response.value)
          )
        : null
    );
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
