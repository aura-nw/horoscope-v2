/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BullableService, { QueueHandler } from 'src/base/BullableService';
import RedisMixin from 'src/common/mixins/redis/redis.mixin';
import { Config } from 'src/common';
import { Job } from 'bull';
import Transaction from 'src/models/transaction.model';
import { IAttribute, IEvent } from 'src/entities/transaction.entity';
import {
  BASE_64_ENCODE,
  CONTRACT_TYPE,
  ENRICH_TYPE,
  EVENT_TYPE,
  URL_TYPE_CONSTANTS,
} from 'src/common/constant';
import { fromBase64, fromUtf8 } from '@cosmjs/encoding';
import CodeId, { CodeIDStatus } from 'src/models/CODE_ID.model';
import CallApiMixin from 'src/common/mixins/callApi/call-api.mixin';
import {
  IContractAndTokenID,
  IContractInfo,
} from 'src/common/types/interfaces';
import Utils from 'src/common/utils/utils';

const { CHAIN_ID } = Config;

@Service({
  mixins: [new RedisMixin().start(), new CallApiMixin().start()],
})
export default class CrawlAccountInfoService extends BullableService {
  private _currentBlock = 0;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: 'asset',
    jobType: 'tx_handle',
  })
  private async jobHandler(): Promise<void> {
    const url = Utils.getUrlByChainIdAndType(CHAIN_ID, URL_TYPE_CONSTANTS.LCD);

    if (url != null) {
      this.handleJob(url[0], CHAIN_ID);
      this.handleTxBurnCw721(CHAIN_ID);
    } else {
      throw new Error('Chain not supported');
    }
  }

  async _start(): Promise<void> {
    this.redisClient = await this.getRedisClient();
    await this.initEnv();
    this.createJob(
      'asset',
      'tx_handle',
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: parseInt(Config.ASSET_MILISECOND_REPEAT_JOB, 10),
        },
      }
    );
    this.getQueue('crawl.block').on('completed', (job: Job) => {
      this.logger.info(`Job #${job.id} completed!, result: ${job.returnvalue}`);
    });
    this.getQueue('crawl.block').on('failed', (job: Job) => {
      this.logger.error(`Job #${job.id} failed!, error: ${job.failedReason}`);
    });
    this.getQueue('crawl.block').on('progress', (job: Job) => {
      this.logger.info(`Job #${job.id} progress: ${job.progress()}%`);
    });
  }

  private async handleJob(url: string, chainId: string) {
    const latestTx: Transaction | undefined = await Transaction.query()
      .orderBy('height', 'DESC')
      .first();
    if (!latestTx) {
      throw new Error('Table transaction has no data');
    }
    const startBlock: number = this._currentBlock;
    const endBlock: number = Math.min(
      this._currentBlock + parseInt(Config.ASSET_BLOCK_BATCH, 10),
      latestTx.height
    );
    this.logger.info(`startBlock: ${startBlock} endBlock: ${endBlock}`);
    const listTx: Transaction[] = await Transaction.query().where({
      height: {
        $gte: startBlock,
        $lt: endBlock,
      },
    });
    if (listTx.length > 0) {
      try {
        const listContractAndTokenId =
          this.getContractAndTokenIdFromListTx(listTx);

        if (listContractAndTokenId.length > 0) {
          await Promise.all(
            listContractAndTokenId.map(async (item) => {
              const { contractAddress } = item;
              const { tokenId } = item;
              const processingFlag = await this.broker.cacher?.get(
                `contract_${chainId}_${contractAddress}`
              );
              if (!processingFlag && contractAddress != null) {
                await this.broker.cacher?.set(
                  `contract_${chainId}_${contractAddress}`,
                  true,
                  Config.CACHER_INDEXER_TTL
                );
                const contractInfo = await this.verifyAddressByCodeID(
                  url,
                  contractAddress
                );
                if (contractInfo != null) {
                  if (
                    contractInfo.contractType === CONTRACT_TYPE.CW20 &&
                    !tokenId &&
                    contractAddress
                  ) {
                    this.createJob(
                      'CW20',
                      'enrich',
                      {
                        url,
                        address: contractAddress,
                        codeId: contractInfo.codeId,
                        txhash: item.txhash,
                      },
                      {
                        removeOnComplete: true,
                        removeOnFail: {
                          count: parseInt(
                            Config.BULL_JOB_REMOVE_ON_FAIL_COUNT,
                            10
                          ),
                        },
                        attempts: parseInt(Config.BULL_JOB_ATTEMPT, 10),
                        backoff: parseInt(Config.BULL_JOB_BACKOFF, 10),
                      }
                    );
                  }
                  if (
                    contractInfo.contractType === CONTRACT_TYPE.CW721 &&
                    tokenId &&
                    contractAddress
                  ) {
                    this.createJob(
                      'CW721',
                      'enrich-tokenid',
                      {
                        url,
                        address: contractAddress,
                        codeId: contractInfo.codeId,
                        typeEnrich: ENRICH_TYPE.UPSERT,
                        chainId,
                        tokenId,
                      },
                      {
                        removeOnComplete: true,
                        removeOnFail: {
                          count: parseInt(
                            Config.BULL_JOB_REMOVE_ON_FAIL_COUNT,
                            10
                          ),
                        },
                        attempts: parseInt(Config.BULL_JOB_ATTEMPT, 10),
                        backoff: parseInt(Config.BULL_JOB_BACKOFF, 10),
                      }
                    );
                  }
                  if (
                    contractInfo.contractType === CONTRACT_TYPE.CW4973 &&
                    tokenId &&
                    contractAddress
                  ) {
                    this.createJob(
                      'CW4973',
                      'enrich-tokenid',
                      {
                        url,
                        address: contractAddress,
                        codeId: contractInfo.codeId,
                        typeEnrich: ENRICH_TYPE.UPSERT,
                        chainId,
                        tokenId,
                      },
                      {
                        removeOnComplete: true,
                        removeOnFail: {
                          count: parseInt(
                            Config.BULL_JOB_REMOVE_ON_FAIL_COUNT,
                            10
                          ),
                        },
                        attempts: parseInt(Config.BULL_JOB_ATTEMPT, 10),
                        backoff: parseInt(Config.BULL_JOB_BACKOFF, 10),
                      }
                    );
                  }
                }
                // This.logger.debug(`Contract's type does not verify!`, address);
                await this.broker.cacher?.del(
                  `contract_${chainId}_${contractAddress}`
                );
              }
            })
          );
          // Await updateInforPromises;
        }
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  private async initEnv() {
    // Get handled block
    const handledBlockRedis = await this.redisClient.get(
      Config.REDIS_KEY_CURRENT_ASSET_BLOCK
    );
    const { ASSET_START_BLOCK } = Config;

    if (handledBlockRedis) {
      this._currentBlock = parseInt(handledBlockRedis, 10);
      // eslint-disable-next-line no-restricted-globals
    } else if (!isNaN(ASSET_START_BLOCK)) {
      this._currentBlock = parseInt(ASSET_START_BLOCK, 10);
    } else {
      this._currentBlock = 0;
    }
    this._currentBlock = handledBlockRedis
      ? parseInt(handledBlockRedis, 10)
      : this._currentBlock;
    this.logger.info(`_currentBlock: ${this._currentBlock}`);
  }

  private getContractAndTokenIdFromListTx(
    listTx: Transaction[]
  ): IContractAndTokenID[] {
    const listContractAndTokenID: IContractAndTokenID[] = [];
    if (listTx.length > 0) {
      listTx.forEach((tx: Transaction) => {
        // eslint-disable-next-line array-callback-return
        tx.logs.map((event: IEvent) => {
          const type = event.type.toString();
          const { attributes } = event;
          if (type === EVENT_TYPE.WASM) {
            let contractFromEvent: string | null = null;
            let tokenIdFromEvent: string | null = null;
            // eslint-disable-next-line array-callback-return
            attributes.map((attribute: IAttribute) => {
              const key = attribute.key.toString();
              // eslint-disable-next-line no-underscore-dangle
              if (key === BASE_64_ENCODE._CONTRACT_ADDRESS) {
                const value = fromUtf8(fromBase64(attribute.value.toString()));
                contractFromEvent = value;
              }
              if (key === BASE_64_ENCODE.TOKEN_ID) {
                const value = fromUtf8(fromBase64(attribute.value.toString()));
                tokenIdFromEvent = value;
              }
            });
            listContractAndTokenID.push({
              contractAddress: contractFromEvent,
              tokenId: tokenIdFromEvent,
              txhash: tx.hash,
            });
          }
        });
      });
    }
    return listContractAndTokenID;
  }

  private async verifyAddressByCodeID(url: string, address: string) {
    const urlGetContractInfo = `${Config.CONTRACT_URI}${address}`;
    const contractInfo: IContractInfo | null = await this.callApiFromDomain(
      url,
      urlGetContractInfo
    );
    if (
      contractInfo != null &&
      contractInfo.contract_info.code_id !== undefined
    ) {
      const res: CodeId[] = await CodeId.query().where({
        code_id: contractInfo.contract_info.code_id,
      });
      this.logger.debug('codeid-manager.find res', res);
      if (res.length > 0) {
        if (
          res[0].status === CodeIDStatus.COMPLETED ||
          res[0].status === CodeIDStatus.WAITING ||
          res[0].status === CodeIDStatus.TBD
        ) {
          return {
            codeId: contractInfo.contract_info.code_id,
            contractType: res[0].contract_type,
            status: res[0].status,
          };
        }
        return null;
      }
      return null;
    }
    this.logger.error(
      'verifyAddressByCodeID Fail to get token info',
      urlGetContractInfo
    );
    return null;
  }
}
