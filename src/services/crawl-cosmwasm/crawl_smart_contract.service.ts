/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { fromUtf8 } from '@cosmjs/encoding';
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
    jobName: BULL_JOB_NAME.CRAWL_SMART_CONTRACT,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  public async handleJob(_payload: object): Promise<void> {
    const queryAddresses: string[] = [];
    const smartContracts: SmartContract[] = [];

    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_SMART_CONTRACT,
        [BULL_JOB_NAME.CRAWL_CODE],
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

          const [contractCw2s, contractInfos] =
            await SmartContract.getContractInfo(
              queryAddresses,
              this._httpBatchClient
            );

          const codeIds: number[] = [];
          const updateContractTypes: any[] = [];
          smartContracts.forEach((contract, index) => {
            if (contractCw2s[index]?.data) {
              const data = JSON.parse(
                fromUtf8(contractCw2s[index]?.data || new Uint8Array())
              );
              contract.name = data.contract;
              contract.version = data.version;

              const codeTypes = Code.detectCodeType(data.contract);
              if (codeTypes !== '')
                updateContractTypes.push(
                  Code.query().patch({ type: codeTypes }).where({
                    code_id:
                      contractInfos[index]?.contractInfo?.codeId.toString(),
                  })
                );
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

          if (updateContractTypes.length > 0)
            await Promise.all(updateContractTypes);

          if (smartContracts.length > 0)
            await SmartContract.query()
              .insert(smartContracts)
              .onConflict('address')
              .merge()
              .returning('address')
              .transacting(trx)
              .catch((error) => {
                this.logger.error(
                  `Error insert new smart contracts: ${JSON.stringify(
                    smartContracts
                  )}`
                );
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
      }
    );

    return super._start();
  }
}
