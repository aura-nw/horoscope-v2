/* eslint-disable import/no-extraneous-dependencies */
import { Context, ServiceBroker } from 'moleculer';
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { HttpBatchClient } from '@cosmjs/tendermint-rpc';
import { createJsonRpcRequest } from '@cosmjs/tendermint-rpc/build/jsonrpc';
import { GeneratedType, Registry, decodeTxRaw } from '@cosmjs/proto-signing';
import { defaultRegistryTypes as defaultStargateTypes } from '@cosmjs/stargate';

import { wasmTypes } from '@cosmjs/cosmwasm-stargate/build/modules';
import { Header } from 'cosmjs-types/ibc/lightclients/tendermint/v1/tendermint';
import {
  BasicAllowance,
  PeriodicAllowance,
} from 'cosmjs-types/cosmos/feegrant/v1beta1/feegrant';
import { cosmos } from '@aura-nw/aurajs';
import { toBase64, fromBase64, fromUtf8 } from '@cosmjs/encoding';
import _ from 'lodash';
import { JsonRpcSuccessResponse } from '@cosmjs/json-rpc';
import {
  BULL_JOB_NAME,
  getHttpBatchClient,
  MSG_TYPE,
  SERVICE,
  SERVICE_NAME,
} from '../../common';
import { Event, Transaction } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE_NAME.CRAWL_TRANSACTION,
  version: 1,
})
export default class CrawlTxService extends BullableService {
  private _httpBatchClient: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_TRANSACTION,
    jobType: BULL_JOB_NAME.CRAWL_TRANSACTION,
    prefix: `horoscope-v2-${config.chainId}`,
  })
  private async jobHandlerCrawlTx(_payload: {
    listBlock: [{ height: number; timestamp: string }];
  }): Promise<void> {
    const listPromise: Promise<any>[] = [];
    const mapBlockTime: Map<number, string> = new Map();
    _payload.listBlock.forEach((block) => {
      this.logger.info('crawl tx by height: ', block.height);
      mapBlockTime[block.height.toString()] = block.timestamp;
      listPromise.push(
        this._httpBatchClient.execute(
          createJsonRpcRequest('tx_search', {
            query: `tx.height=${block.height}`,
          })
        )
      );
    });
    const resultListPromise: JsonRpcSuccessResponse[] = await Promise.all(
      listPromise
    );
    resultListPromise.forEach((result) => {
      if (result.result.total_count !== '0') {
        this.createJob(
          BULL_JOB_NAME.HANDLE_TRANSACTION,
          BULL_JOB_NAME.HANDLE_TRANSACTION,
          {
            listTx: result.result,
            height: result.result.txs[0].height,
            timestamp: mapBlockTime[result.result.txs[0].height],
          }
        );
      }
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_TRANSACTION,
    jobType: BULL_JOB_NAME.HANDLE_TRANSACTION,
    prefix: `horoscope-v2-${config.chainId}`,
  })
  private async jobHandlerTx(_payload: any): Promise<void> {
    const { listTx, timestamp, height } = _payload;
    const listHandleTx: any[] = [];
    if (listTx.total_count === '0') {
      return;
    }
    try {
      // check if tx existed
      const mapExistedTx: Map<string, boolean> = new Map();
      const listHash = listTx.txs.map((tx: any) => tx.hash);
      const listTxExisted = await Transaction.query().whereIn('hash', listHash);
      listTxExisted.forEach((tx) => {
        mapExistedTx.set(tx.hash, true);
      });

      const registry = await this._getRegistry();
      // parse tx to format LCD return
      listTx.txs.forEach((tx: any) => {
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
          let decodedMsg = this._decodedMsg(registry, msg);
          decodedMsg = this._camelizeKeys(decodedMsg);
          decodedMsg['@type'] = msg.typeUrl;
          return decodedMsg;
        });

        parsedTx.tx = {
          body: {
            messages: decodedMsgs,
          },
          auth_info: {
            fee: {
              amount: decodedTx.authInfo.fee?.amount,
              gas_limit: decodedTx.authInfo.fee?.gasLimit,
              granter: decodedTx.authInfo.fee?.granter,
              payer: decodedTx.authInfo.fee?.payer,
            },
            signer_infos: decodedTx.authInfo.signerInfos.map((signerInfo) => {
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
            }),
          },
          signatures: decodedTx.signatures,
        };
        // const msg = fromUtf8(tx.tx.body.messages[0].msg);

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

      await this._handleListTx(listHandleTx, timestamp, height);
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  @Action({
    name: SERVICE.V1.CrawlTransaction.CrawlTxByHeight.key,
  })
  async CrawlTxByHeight(
    ctx: Context<{ listBlock: [{ height: number; timestamp: string }] }>
  ) {
    this.createJob(
      BULL_JOB_NAME.CRAWL_TRANSACTION,
      BULL_JOB_NAME.CRAWL_TRANSACTION,
      {
        listBlock: ctx.params.listBlock,
      }
    );
  }

  async _handleListTx(listTx: any, timestamp: string, height: number) {
    this.logger.debug(listTx);
    const listTxModel: any[] = [];
    listTx.forEach((tx: any) => {
      this.logger.debug(tx, timestamp);
      let sender = '';
      try {
        sender = fromUtf8(
          fromBase64(
            this._findAttribute(
              tx.tx_response.events,
              'message',
              // c2VuZGVy is sender in base64
              'c2VuZGVy'
            )
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
        ...Transaction.fromJson({
          height: parseInt(tx.tx_response.height, 10),
          hash: tx.tx_response.txhash,
          codespace: tx.tx_response.codespace,
          code: parseInt(tx.tx_response.code, 10),
          gas_used: tx.tx_response.gas_used.toString(),
          gas_wanted: tx.tx_response.gas_wanted.toString(),
          gas_limit: tx.tx.auth_info.fee.gas_limit.toString(),
          fee: JSON.stringify(tx.tx.auth_info.fee.amount),
          timestamp,
          data: tx,
        }),
        events: tx.tx_response.events.map((event: any) => ({
          tx_msg_index: event.msg_index ?? undefined,
          type: event.type,
          attributes: event.attributes.map((attribute: any) => ({
            block_height: parseInt(tx.tx_response.height, 10),
            composite_key: attribute?.key
              ? `${event.type}.${fromUtf8(fromBase64(attribute?.key))}`
              : null,
            key: attribute?.key ? fromUtf8(fromBase64(attribute?.key)) : null,
            value: attribute?.value
              ? fromUtf8(fromBase64(attribute?.value))
              : null,
          })),
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

    const resultInsertGraph = await Transaction.query().insertGraph(
      listTxModel
    );
    this.logger.debug('result insert tx', resultInsertGraph);
  }

  private setMsgIndexToEvent(tx: any) {
    const mapEventMsgIdx: Map<string, number[]> = new Map();

    // set index_msg from log to mapEventMsgIdx
    tx.tx_response.logs?.forEach((log: any, index: number) => {
      log.events.forEach((event: any) => {
        const { type } = event;
        event.attributes.forEach((attribute: any) => {
          const keyInMap = `${type}_${attribute.key}_${attribute.value}`;
          if (mapEventMsgIdx.has(keyInMap)) {
            const listIndex = mapEventMsgIdx.get(keyInMap);
            listIndex?.push(listIndex.length);
          } else {
            mapEventMsgIdx.set(keyInMap, [index]);
          }
        });
      });
    });

    // set index_msg from mapEventMsgIdx to event
    tx.tx_response.events.forEach((event: any) => {
      const { type } = event;
      event.attributes.forEach((attribute: any) => {
        const key = attribute?.key
          ? fromUtf8(fromBase64(attribute?.key))
          : null;
        const value = attribute?.value
          ? fromUtf8(fromBase64(attribute?.value))
          : null;
        const keyInMap = `${type}_${key}_${value}`;

        const listIndex = mapEventMsgIdx.get(keyInMap);
        // get first index with this key
        const firstIndex = listIndex?.shift();

        if (firstIndex != null) {
          if (event.msg_index && event.msg_index !== firstIndex) {
            this.logger.warn(
              `something wrong: setting index ${firstIndex} to existed index ${event.msg_index}`
            );
          } else {
            // eslint-disable-next-line no-param-reassign
            event.msg_index = firstIndex;
          }
        }

        // delete key in map if value is empty
        if (listIndex?.length === 0) {
          mapEventMsgIdx.delete(keyInMap);
        }
      });
    });
  }

  private async _getRegistry(): Promise<Registry> {
    if (this.registry) {
      return this.registry;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const registry = new Registry([...defaultStargateTypes, ...wasmTypes]);
    registry.register(
      '/cosmos.feegrant.v1beta1.BasicAllowance',
      BasicAllowance
    );
    registry.register(
      '/cosmos.feegrant.v1beta1.PeriodicAllowance',
      PeriodicAllowance
    );
    registry.register('/ibc.lightclients.tendermint.v1.Header', Header);
    registry.register(
      '/cosmos.feegrant.v1beta1.AllowedContractAllowance',
      cosmos.feegrant.v1beta1.AllowedContractAllowance as GeneratedType
    );
    registry.register(
      '/cosmos.vesting.v1beta1.MsgCreatePeriodicVestingAccount',
      cosmos.vesting.v1beta1.MsgCreatePeriodicVestingAccount as GeneratedType
    );
    this.registry = registry;
    return this.registry;
  }

  // convert camelcase to underscore
  private _camelizeKeys(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((v: any) => this._camelizeKeys(v));
    }
    if (obj != null && obj.constructor === Object) {
      return Object.keys(obj).reduce(
        (result, key) => ({
          ...result,
          [key === '@type' ? '@type' : _.snakeCase(key)]: this._camelizeKeys(
            obj[key]
          ),
        }),
        {}
      );
    }
    return obj;
  }

  private _decodedMsg(registry: Registry, msg: any): any {
    const result: any = {};
    if (!msg) {
      return;
    }
    if (msg.typeUrl) {
      result['@type'] = msg.typeUrl;
      const found = registry.lookupType(msg.typeUrl);
      if (!found) {
        const decodedBase64 = toBase64(msg.value);
        this.logger.info(decodedBase64);
        result.value = decodedBase64;
        this.logger.error('This typeUrl is not supported');
        this.logger.error(msg.typeUrl);
      } else {
        const decoded = registry.decode(msg);

        Object.keys(decoded).forEach((key) => {
          result[key] = decoded[key];
        });
      }

      if (
        msg.typeUrl === MSG_TYPE.MSG_EXECUTE_CONTRACT ||
        msg.typeUrl === MSG_TYPE.MSG_INSTANTIATE_CONTRACT
      ) {
        if (result.msg && result.msg instanceof Uint8Array) {
          result.msg = fromUtf8(result.msg);
        }
      } else if (msg.typeUrl === MSG_TYPE.MSG_UPDATE_CLIENT) {
        if (result.header?.value && result.header?.typeUrl) {
          result.header = registry.decode(result.header);
        }
      }
    }

    // eslint-disable-next-line consistent-return
    return result;
  }

  private _findAttribute(
    events: any,
    eventType: string,
    attributeKey: string
  ): string {
    let result = '';
    events.forEach((event: any) => {
      if (event.type === eventType) {
        event.attributes.forEach((attribute: any) => {
          if (attribute.key === attributeKey) {
            result = attribute.value;
          }
        });
      }
    });
    if (!result.length) {
      throw new Error(
        `Could not find attribute ${attributeKey} in event type ${eventType}`
      );
    }
    return result;
  }

  public async _start() {
    return super._start();
  }
}
