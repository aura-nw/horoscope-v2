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
import { aura, cosmos } from '@aura-nw/aurajs';
import { toBase64, fromBase64 } from '@cosmjs/encoding';
import long from 'long';
import _ from 'lodash';
import Transaction from '../../models/transaction';
import Utils from '../../common/utils/utils';
import { getHttpBatchClient } from '../../common/utils/cosmjs_client';
import BullableService, { QueueHandler } from '../../base/bullable.service';

@Service({
  name: 'crawl.tx',
  version: 1,
})
export default class CrawlTxService extends BullableService {
  private _lcdClient: any;

  private _httpBatchClient: HttpBatchClient;

  public constructor(public broker: ServiceBroker) {
    super(broker);
    this._httpBatchClient = getHttpBatchClient();
  }

  @QueueHandler({
    queueName: 'crawl.tx',
    jobType: 'crawl.tx',
    prefix: 'horoscope_',
  })
  private async jobHandlerCrawlTx(_payload: any): Promise<void> {
    const { height, timestamp } = _payload;
    this.broker.call('v1.crawl.tx.crawlTxByHeight', { height, timestamp });
  }

  @QueueHandler({
    queueName: 'handle.tx',
    jobType: 'handle.tx',
    prefix: 'horoscope_',
  })
  private async jobHandlerTx(_payload: any): Promise<void> {
    const { listTx, timestamp } = _payload;
    const listHandleTx: any[] = [];
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
        if (mapExistedTx.get(tx.txhash)) {
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

      await this._handleListTx(listHandleTx, timestamp);
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  @Action({
    name: 'crawlTxByHeight',
  })
  async crawlTxByHeight(ctx: Context<{ height: number; timestamp: string }>) {
    this.logger.info(ctx.params.height);
    const resultJsonRpc = await this._httpBatchClient.execute(
      createJsonRpcRequest('tx_search', {
        query: `tx.height=${ctx.params.height}`,
      })
    );
    this.createJob('handle.tx', 'handle.tx', {
      listTx: resultJsonRpc.result,
      timestamp: ctx.params.timestamp,
    });
  }

  async _handleListTx(listTx: any, timestamp: string) {
    this.logger.info(listTx);
    listTx.txs.forEach((element: any) => {
      this.logger.info(element, timestamp);
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
      aura.feegrant.v1beta1.AllowedContractAllowance as GeneratedType
    );
    registry.register(
      '/cosmos.vesting.v1beta1.MsgCreatePeriodicVestingAccount',
      cosmos.vesting.v1beta1.MsgCreatePeriodicVestingAccount as GeneratedType
    );

    registry.register(
      '/cosmos.vesting.v1beta1.MsgCreatePermanentLockedAccount',
      cosmos.vesting.v1beta1.MsgCreatePermanentLockedAccount as GeneratedType
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
    let result: any = {};
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
          result[key] = this._decodedMsg(registry, decoded[key]);
        });
      }
    } else if (msg.seconds && msg.nanos) {
      result = new Date(msg.seconds.toNumber() * 1000 + msg.nanos / 1e6);
    } else if (Array.isArray(msg)) {
      result = msg.map((element) => this._decodedMsg(registry, element));
    } else if (msg instanceof Uint8Array) {
      result = this._decodedMsg(registry, toBase64(msg));
    } else if (long.isLong(msg) || typeof msg === 'string') {
      if (typeof msg === 'string') {
        try {
          const decodedBase64 = JSON.parse(
            Buffer.from(msg, 'base64').toString()
          );
          Object.keys(decodedBase64).forEach((key) => {
            result[key] = this._decodedMsg(registry, decodedBase64[key]);
          });
        } catch (e) {
          this.logger.debug('this msg is not base64: ', msg);
          result = msg.toString();
        }
      } else {
        result = msg.toString();
      }
    } else if (typeof msg === 'number' || typeof msg === 'boolean') {
      result = msg;
    } else if (msg instanceof Object) {
      Object.keys(msg).forEach((key) => {
        result[key] = this._decodedMsg(registry, msg[key]);
      });
    } else {
      result = this._decodedMsg(registry, msg);
    }
    // eslint-disable-next-line consistent-return
    return result;
  }

  // scan all address in msg tx
  private _scanAllAddressInTxInput(msg: any): any[] {
    const listAddress: any[] = [];
    if (msg != null && msg.constructor === Object) {
      Object.values(msg).forEach((value: any) => {
        if (value != null && value.constructor === Object) {
          listAddress.push(...this._scanAllAddressInTxInput(value));
        } else if (Array.isArray(value)) {
          listAddress.push(
            // eslint-disable-next-line array-callback-return
            ...value.filter((e: any) => {
              Utils.isValidAddress(e);
            })
          );
        } else if (Utils.isValidAddress(value)) {
          listAddress.push(value);
        }
      });
    }
    return listAddress;
  }

  public async _start() {
    this.createJob('crawl.tx', 'crawl.tx', {
      height: 5250518,
      timestamp: '2023-03-13T07:59:23.228Z',
    });
    return super._start();
  }
}
