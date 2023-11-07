/* eslint-disable import/no-extraneous-dependencies */
import { ServiceBroker } from 'moleculer';
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { decodeTxRaw } from '@cosmjs/proto-signing';
import { toBase64, fromBase64 } from '@cosmjs/encoding';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import { Knex } from 'knex';
import { Queue } from 'bullmq';
import { GetNodeInfoResponseSDKType } from '@aura-nw/aurajs/types/codegen/cosmos/base/tendermint/v1beta1/query';
import Utils from '../../common/utils/utils';
import {
  BULL_JOB_NAME,
  getHttpBatchClient,
  getLcdClient,
  SERVICE,
} from '../../common';
import { Block, BlockCheckpoint, Event, Transaction } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';
import ChainRegistry from './chain.registry';

@Service({
  name: SERVICE.V1.CrawlTransaction.key,
  version: 1,
})
export default class CrawlTxService extends BullableService {
  private _httpBatchClient: HttpBatchClient;

  public _registry!: ChainRegistry;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_TRANSACTION,
    jobName: BULL_JOB_NAME.HANDLE_TRANSACTION,
  })
  public async jobHandlerCrawlTx(): Promise<void> {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_TRANSACTION,
        [BULL_JOB_NAME.CRAWL_BLOCK],
        config.handleTransaction.key
      );

    this.logger.info(
      `Handle transaction from block ${startBlock} to ${endBlock}`
    );

    if (startBlock > endBlock) {
      return;
    }
    const listTxRaw = await this.getListRawTx(startBlock, endBlock);
    const listdecodedTx = await this.decodeListRawTx(listTxRaw);
    await knex.transaction(async (trx) => {
      await this.insertDecodedTxAndRelated(listdecodedTx, trx);
      if (blockCheckpoint) {
        blockCheckpoint.height = endBlock;
        await BlockCheckpoint.query()
          .insert(blockCheckpoint)
          .onConflict('job_name')
          .merge()
          .returning('id')
          .transacting(trx);
      }
    });
  }

  // get list raw tx from block to block
  async getListRawTx(
    startBlock: number,
    endBlock: number
  ): Promise<{ listTx: any; height: number; timestamp: string }[]> {
    const blocks: any[] = await Block.query()
      .select(
        'height',
        'time',
        knex.raw("\"data\" #>ARRAY['block', 'data', 'txs'] AS txs")
      )
      .where('height', '>', startBlock)
      .andWhere('height', '<=', endBlock)
      .orderBy('height', 'asc');
    this.logger.debug(blocks);
    const promises: any[] = [];
    const filterBlocks = blocks.filter((block) => block.txs.length > 0);
    filterBlocks.forEach((block) => {
      this.logger.info('crawl tx by height: ', block.height);

      const totalPages = Math.ceil(
        block.txs.length / config.handleTransaction.txsPerCall
      );
      [...Array(totalPages)].forEach((e, i) => {
        const pageIndex = (i + 1).toString();
        promises.push(
          this._httpBatchClient.execute(
            createJsonRpcRequest('tx_search', {
              query: `tx.height=${block.height}`,
              page: pageIndex,
              per_page: config.handleTransaction.txsPerCall.toString(),
            })
          )
        );
      });
    });
    const resultPromises: JsonRpcSuccessResponse[] = await Promise.all(
      promises
    );

    const listRawTx: any[] = filterBlocks.map((block) => {
      const listTxs: any[] = [];
      resultPromises
        .filter(
          (result) => result.result.txs[0].height === block.height.toString()
        )
        .forEach((resultPromise) => {
          listTxs.push(...resultPromise.result.txs);
        });
      return {
        listTx: {
          txs: listTxs,
          total_count: block.txs.length,
        },
        height: block.height,
        timestamp: block.time,
      };
    });
    return listRawTx;
  }

  // decode list raw tx
  async decodeListRawTx(
    listRawTx: { listTx: any; height: number; timestamp: string }[]
  ): Promise<{ listTx: any; height: number; timestamp: string }[]> {
    const listDecodedTx = await Promise.all(
      listRawTx.map(async (payloadBlock) => {
        const { listTx, timestamp, height } = payloadBlock;
        const listHandleTx: any[] = [];
        try {
          // check if tx existed
          const mapExistedTx: Map<string, boolean> = new Map();
          const listHash = listTx.txs.map((tx: any) => tx.hash);
          const listTxExisted = await Transaction.query().whereIn(
            'hash',
            listHash
          );
          listTxExisted.forEach((tx) => {
            mapExistedTx.set(tx.hash, true);
          });

          // parse tx to format LCD return
          listTx.txs.forEach((tx: any, index: number) => {
            this.logger.info(`Handle txhash ${tx.hash}`);
            if (mapExistedTx.get(tx.hash)) {
              return;
            }
            // decode tx to readable
            const decodedTx = decodeTxRaw(fromBase64(tx.tx));

            const parsedTx: any = {};
            parsedTx.tx = decodedTx;
            parsedTx.tx.signatures = decodedTx.signatures.map(
              (signature: Uint8Array) => toBase64(signature)
            );

            const decodedMsgs = decodedTx.body.messages.map((msg) => {
              const decodedMsg = Utils.camelizeKeys(
                this._registry.decodeMsg(msg)
              );
              decodedMsg['@type'] = msg.typeUrl;
              return decodedMsg;
            });

            parsedTx.tx = {
              body: {
                messages: decodedMsgs,
                memo: decodedTx.body?.memo,
                timeout_height: decodedTx.body?.timeoutHeight,
                extension_options: decodedTx.body?.extensionOptions,
                non_critical_extension_options:
                  decodedTx.body?.nonCriticalExtensionOptions,
              },
              auth_info: {
                fee: {
                  amount: decodedTx.authInfo.fee?.amount,
                  gas_limit: decodedTx.authInfo.fee?.gasLimit,
                  granter: decodedTx.authInfo.fee?.granter,
                  payer: decodedTx.authInfo.fee?.payer,
                },
                signer_infos: decodedTx.authInfo.signerInfos.map(
                  (signerInfo) => {
                    const pubkey = signerInfo.publicKey?.value;

                    if (pubkey instanceof Uint8Array) {
                      return {
                        mode_info: signerInfo.modeInfo,
                        public_key: {
                          '@type': signerInfo.publicKey?.typeUrl,
                          key: toBase64(pubkey.slice(2)),
                        },
                        sequence: signerInfo.sequence.toString(),
                      };
                    }
                    return {
                      mode_info: signerInfo.modeInfo,
                      sequence: signerInfo.sequence.toString(),
                    };
                  }
                ),
              },
              signatures: decodedTx.signatures,
            };

            parsedTx.tx_response = {
              height: tx.height,
              txhash: tx.hash,
              codespace: tx.tx_result.codespace,
              code: tx.tx_result.code,
              data: tx.tx_result.data,
              raw_log: tx.tx_result.log,
              info: tx.tx_result.info,
              gas_wanted: tx.tx_result.gas_wanted,
              gas_used: tx.tx_result.gas_used,
              tx: tx.tx,
              index,
              events: tx.tx_result.events,
              timestamp,
            };
            try {
              parsedTx.tx_response.logs = JSON.parse(tx.tx_result.log);
            } catch (error) {
              this.logger.debug('tx fail');
            }
            listHandleTx.push(parsedTx);
          });

          return { listTx: listHandleTx, timestamp, height };
        } catch (error) {
          this.logger.error(error);
          throw error;
        }
      })
    );
    return listDecodedTx;
  }

  // insert list decoded tx and related table (event, event_attribute, message, message_received)
  async insertDecodedTxAndRelated(
    listDecodedTx: { listTx: any; height: number; timestamp: string }[],
    transactionDB: Knex.Transaction
  ) {
    this.logger.debug(listDecodedTx);
    const listTxModel: any[] = [];
    listDecodedTx.forEach((payloadBlock) => {
      const { listTx, height, timestamp } = payloadBlock;
      listTx.forEach((tx: any, indexTx: number) => {
        this.logger.debug(tx, timestamp);
        let sender = '';
        try {
          sender = this._registry.decodeAttribute(
            this._findAttribute(
              tx.tx_response.events,
              'message',
              this._registry.encodeAttribute('sender')
            )
          );
        } catch (error) {
          this.logger.warn(
            'txhash not has sender event: ',
            tx.tx_response.txhash
          );
          this.logger.warn(error);
        }

        // scan list transfer.recipient and wasm.recipient
        const listAddressReceiver: any[][] = [[]];
        tx.tx_response?.logs?.forEach((log: any, index: number) => {
          log.events?.forEach((event: any) => {
            if (event.type === 'transfer' || event.type === 'wasm') {
              event.attributes.forEach((attribute: any) => {
                if (attribute.key === 'recipient') {
                  listAddressReceiver[index]?.push({
                    address: attribute.value,
                    reason: `${event.type}.${attribute.key}`,
                  });
                }
              });
            }
          });
        });

        // set index to event
        this.setMsgIndexToEvent(tx);

        const txInsert = {
          '#id': `transaction-${height}-${indexTx}`,
          ...Transaction.fromJson({
            index: tx.tx_response.index,
            height: parseInt(tx.tx_response.height, 10),
            hash: tx.tx_response.txhash,
            codespace: tx.tx_response.codespace ?? '',
            code: parseInt(tx.tx_response.code ?? '0', 10),
            gas_used: tx.tx_response.gas_used?.toString() ?? '0',
            gas_wanted: tx.tx_response.gas_wanted?.toString() ?? '0',
            gas_limit: tx.tx.auth_info.fee.gas_limit?.toString() ?? '0',
            fee: JSON.stringify(tx.tx.auth_info.fee.amount),
            timestamp,
            data: config.handleTransaction.saveRawLog ? tx : null,
            memo: tx.tx.body.memo,
          }),
          events: tx.tx_response.events?.map((event: any) => ({
            tx_msg_index: event.msg_index ?? undefined,
            type: event.type,
            attributes: event.attributes.map(
              (attribute: any, index: number) => ({
                tx_id: `#ref{transaction-${height}-${indexTx}.id}`,
                block_height: parseInt(tx.tx_response.height, 10),
                index,
                composite_key: attribute?.key
                  ? `${event.type}.${this._registry.decodeAttribute(
                      attribute?.key
                    )}`
                  : null,
                key: attribute?.key
                  ? this._registry.decodeAttribute(attribute?.key)
                  : null,
                value: attribute?.value
                  ? this._registry.decodeAttribute(attribute?.value)
                  : null,
              })
            ),
            block_height: height,
            source: Event.SOURCE.TX_EVENT,
          })),
          messages: tx.tx.body.messages.map((message: any, index: any) => ({
            sender,
            index,
            type: message['@type'],
            content: message,
            receivers: listAddressReceiver[index],
          })),
        };
        listTxModel.push(txInsert);
      });
    });

    const resultInsertGraph = await Transaction.query()
      .insertGraph(listTxModel, { allowRefs: true })
      .transacting(transactionDB);
    this.logger.debug('result insert tx', resultInsertGraph);
  }

  public mappingFlatEventToLog(
    eventHasIndex: any,
    eventEncodedFlat: any,
    indexMsg: number
  ) {
    const attributesInEvent = eventHasIndex.attributes;
    // i, j are index of eventHasIndex and eventEncodedFlat
    let i = 0;
    let j = 0;
    while (i < attributesInEvent.length && j < eventEncodedFlat.length) {
      // find last element with same eventIndex
      let lastIndexSameEvent = j;
      while (
        lastIndexSameEvent < eventEncodedFlat.length &&
        eventEncodedFlat[lastIndexSameEvent].indexEvent ===
          eventEncodedFlat[j].indexEvent
      ) {
        lastIndexSameEvent += 1;
      }

      if (
        attributesInEvent[i].key === eventEncodedFlat[j].key &&
        attributesInEvent[i].value === eventEncodedFlat[j].value
      ) {
        const isEventMapped = eventEncodedFlat
          .slice(j, lastIndexSameEvent)
          // eslint-disable-next-line @typescript-eslint/no-loop-func, no-inner-declarations
          .every((item: any, index: number) => {
            if (
              attributesInEvent[i + index].key === item.key &&
              attributesInEvent[i + index].value === item.value
            ) {
              return true;
            }
            return false;
          });
        if (isEventMapped) {
          // mark event encoded to be mapped
          for (let k = j; k < lastIndexSameEvent; k += 1) {
            // eslint-disable-next-line no-param-reassign
            eventEncodedFlat[k].indexMapped = indexMsg;
          }
          i += lastIndexSameEvent - j;
        }
      }
      j = lastIndexSameEvent;
    }
  }

  // self check msg index by counting event
  private selfCheckByAnotherWay(tx: any) {
    // count total attribute for each message, countAttributeInEvent[i] = x mean message i has x attributes
    const countAttributeInEvent: number[] = [];
    tx.tx_response.logs.forEach((log: any) => {
      const countAttribute = log.events.reduce(
        (acc: number, curr: any) => acc + curr.attributes.length,
        0
      );
      countAttributeInEvent.push(countAttribute);
    });

    let reachLastEventTypeTx = false;
    let countCurrentAttribute = 0;
    let currentCompareEventId = 0;
    for (let i = 0; i < tx.tx_response.events.length; i += 1) {
      if (tx.tx_response.events[i].type === 'tx') {
        reachLastEventTypeTx = true;
      }
      if (reachLastEventTypeTx && tx.tx_response.events[i].type !== 'tx') {
        if (
          countCurrentAttribute < countAttributeInEvent[currentCompareEventId]
        ) {
          countCurrentAttribute += tx.tx_response.events[i].attributes.length;
        }

        // after count, check if count is equal countAttributeInEvent[currentCompareEventId] or not
        if (
          countCurrentAttribute === countAttributeInEvent[currentCompareEventId]
        ) {
          // if true, count success, then next currentCompareEventId and reset count = 0
          currentCompareEventId += 1;
          countCurrentAttribute = 0;
        } else if (
          countCurrentAttribute > countAttributeInEvent[currentCompareEventId]
        ) {
          this.logger.warn('Count event in log is not equal event encoded');
          return false;
        }
      }
    }
    return true;
  }

  private checkMappingEventToLog(tx: any) {
    this.logger.info('checking mapping log in tx :', tx.tx_response.txhash);
    let flattenLog: string[] = [];
    let flattenEventEncoded: string[] = [];

    tx?.tx_response?.logs?.forEach((log: any, index: number) => {
      log.events.forEach((event: any) => {
        event.attributes.forEach((attr: any) => {
          if (attr.value === undefined) {
            flattenLog.push(`${index}-${event.type}-${attr.key}-null`);
          } else {
            flattenLog.push(`${index}-${event.type}-${attr.key}-${attr.value}`);
          }
        });
      });
    });

    tx?.tx_response?.events?.forEach((event: any) => {
      event.attributes.forEach((attr: any) => {
        if (event.msg_index !== undefined) {
          const key = attr.key
            ? this._registry.decodeAttribute(attr.key)
            : null;
          const value = attr.value
            ? this._registry.decodeAttribute(attr.value)
            : null;
          flattenEventEncoded.push(
            `${event.msg_index}-${event.type}-${key}-${value}`
          );
        }
      });
    });
    // compare 2 array
    if (flattenLog.length !== flattenEventEncoded.length) {
      this.logger.warn('Length between 2 flatten array is not equal');
    }
    flattenLog = flattenLog.sort();
    flattenEventEncoded = flattenEventEncoded.sort();
    const checkResult = flattenLog.every(
      (item: string, index: number) => item === flattenEventEncoded[index]
    );
    if (checkResult === false) {
      this.logger.warn('Mapping event to log is wrong');
    }
  }

  public setMsgIndexToEvent(tx: any) {
    /*------
    DO NOT USE CURRENTLY
    MAPPING BY ORDER IN EVENT AND LOG
    THIS CASE BASED ON ORDER NOT CHANGED BETWEEN EVENT AND LOG
    --------*/
    // // flatten event and decode key value
    // const eventEncodedFlats: any[] = [];
    // tx.tx_response.events.forEach((event: any, index: number) => {
    //   event.attributes.forEach((attr: any) => {
    //     eventEncodedFlats.push({
    //       ...{
    //         key: attr.key ? fromUtf8(fromBase64(attr.key)) : null,
    //         value: attr.value ? fromUtf8(fromBase64(attr.value)) : null,
    //       },
    //       indexEvent: index,
    //       type: event.type,
    //     });
    //   });
    // });
    // // loop logs (has order for each messages)
    // tx.tx_response.logs.forEach((log: any, index: number) => {
    //   // loop each event in log to compare with event encoded
    //   log.events.forEach((eventInLog: any) => {
    //     // filter list event has type equal eventInLog.type and not be setted index msg
    //     const filtedEventByTypeFlat = eventEncodedFlats.filter(
    //       (eventEncoded: any) =>
    //         eventEncoded.type === eventInLog.type &&
    //         eventEncoded.msg_index === undefined
    //     );
    //     // mapping between log and event
    //     this.mappingFlatEventToLog(eventInLog, filtedEventByTypeFlat, index);
    //   });
    // });
    // // set index msg to event encoded
    // eventEncodedFlats
    //   .filter((item: any) => item.indexMapped !== undefined)
    //   .forEach((item: any) => {
    //     if (
    //       tx.tx_response.events[item.indexEvent].msg_index !== undefined &&
    //       tx.tx_response.events[item.indexEvent].msg_index !== item.indexMapped
    //     ) {
    //       this.logger.warn(
    //         `something wrong: setting index ${
    //           item.indexMapped
    //         } to existed index ${
    //           tx.tx_response.eventstx.tx_response.events[item.indexEvent]
    //             .msg_index
    //         }`
    //       );
    //     }
    //     // eslint-disable-next-line no-param-reassign
    //     tx.tx_response.events[item.indexEvent].msg_index = item.indexMapped;
    //   });
    // // self check msg index by counting event
    // const selfCheck = this.selfCheckByAnotherWay(tx);
    // if (!selfCheck) {
    //   this.logger.warn('selfcheck fail');
    // }

    /*---------
    TESTING
    MAPPING EVENT BY COUNT EACH LOG AND EVENT MUST BE SAME
    -----------*/

    // if this is failed tx, then no need to set index msg
    if (!tx.tx_response.logs) {
      this.logger.info('Failed tx, no need to set index msg');
      return;
    }
    // count total attribute for each message, countAttributeInEvent[i] = x mean message i has x attributes
    const countAttributeInEvent: number[] = tx?.tx_response?.logs?.map(
      (log: any) =>
        log.events.reduce(
          (acc: number, curr: any) => acc + curr.attributes.length,
          0
        )
    );

    let reachLastEventTypeTx = false;
    let countCurrentAttribute = 0;
    let currentCompareEventId = 0;
    for (let i = 0; i < tx?.tx_response?.events?.length; i += 1) {
      if (tx.tx_response.events[i].type === 'tx') {
        reachLastEventTypeTx = true;
      }
      if (reachLastEventTypeTx && tx.tx_response.events[i].type !== 'tx') {
        if (
          countCurrentAttribute < countAttributeInEvent[currentCompareEventId]
        ) {
          countCurrentAttribute += tx.tx_response.events[i].attributes.length;
          // eslint-disable-next-line no-param-reassign
          tx.tx_response.events[i].msg_index = currentCompareEventId;
        }

        // after count, check if count is equal countAttributeInEvent[currentCompareEventId] or not
        if (
          countCurrentAttribute === countAttributeInEvent[currentCompareEventId]
        ) {
          // if true, count success, then next currentCompareEventId and reset count = 0
          currentCompareEventId += 1;
          countCurrentAttribute = 0;
        } else if (
          countCurrentAttribute > countAttributeInEvent[currentCompareEventId]
        ) {
          this.logger.warn('Count event in log is not equal event encoded');
        }
      }
    }
    this.checkMappingEventToLog(tx);
  }

  private _findAttribute(
    events: any,
    eventType: string,
    attributeKey: string
  ): string {
    let result = '';
    const foundEvent = events.find(
      (event: any) =>
        event.type === eventType &&
        event.attributes.some(
          (attribute: any) => attribute.key === attributeKey
        )
    );
    if (foundEvent) {
      const foundAttribute = foundEvent.attributes.find(
        (attribute: any) => attribute.key === attributeKey
      );
      result = foundAttribute.value;
    }
    if (!result.length) {
      throw new Error(
        `Could not find attribute ${attributeKey} in event type ${eventType}`
      );
    }
    return result;
  }

  @Action({
    name: SERVICE.V1.CrawlTransaction.TriggerHandleTxJob.key,
  })
  async triggerHandleTxJob() {
    try {
      const queue: Queue = this.getQueueManager().getQueue(
        BULL_JOB_NAME.HANDLE_TRANSACTION
      );
      const jobInDelayed = await queue.getDelayed();
      if (jobInDelayed?.length > 0) {
        await jobInDelayed[0].promote();
      }
    } catch (error) {
      this.logger.error('No job can be promoted');
      this.logger.error(error);
    }
  }

  public async _start() {
    this._registry = new ChainRegistry(this.logger);

    const lcdClient = await getLcdClient();
    // set version cosmos sdk to registry
    const nodeInfo: GetNodeInfoResponseSDKType =
      await lcdClient.aura.cosmos.base.tendermint.v1beta1.getNodeInfo();
    const cosmosSdkVersion = nodeInfo.application_version?.cosmos_sdk_version;
    if (cosmosSdkVersion) {
      this._registry.setCosmosSdkVersionByString(cosmosSdkVersion);
    }

    this.createJob(
      BULL_JOB_NAME.HANDLE_TRANSACTION,
      BULL_JOB_NAME.HANDLE_TRANSACTION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.handleTransaction.millisecondCrawl,
        },
      }
    );
    return super._start();
  }

  public setRegistry(registry: ChainRegistry) {
    this._registry = registry;
  }
}
