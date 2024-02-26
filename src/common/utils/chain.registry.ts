import { Registry, TsProtoGeneratedType } from '@cosmjs/proto-signing';
import { defaultRegistryTypes as defaultStargateTypes } from '@cosmjs/stargate';
import { wasmTypes } from '@cosmjs/cosmwasm-stargate/build/modules';
import { toBase64, fromUtf8, fromBase64, toUtf8 } from '@cosmjs/encoding';
import { LoggerInstance } from 'moleculer';
import _ from 'lodash';
import { SemVer } from 'semver';
import { MSG_TYPE } from '../index';
import Utils from './utils';
import { IProviderRegistry } from './provider.registry';

export default class ChainRegistry {
  public registry!: Registry;

  private _logger: LoggerInstance;

  public cosmos: any;

  public ibc: any;

  public ethermint: any;

  public seiprotocol: any;

  public aura: any;

  public evmos: any;

  public cosmosSdkVersion: SemVer = new SemVer('v0.45.17');

  public decodeAttribute: any;

  public encodeAttribute: any;

  public txRegistryType: any;

  constructor(logger: LoggerInstance, providerRegistry: IProviderRegistry) {
    this._logger = logger;
    this.cosmos = providerRegistry.cosmos;
    this.ibc = providerRegistry.ibc;
    this.txRegistryType = providerRegistry.txRegistryType;
    this.aura = providerRegistry.aura;
    this.seiprotocol = providerRegistry.seiprotocol;
    this.evmos = providerRegistry.evmos;
    this.ethermint = providerRegistry.ethermint;

    // set default registry to decode msg
    this.registry = new Registry([
      ...defaultStargateTypes,
      ...wasmTypes,
      ...this.txRegistryType.map((type: string) => [
        type,
        _.get(this, type.slice(1)),
      ]),
    ]);
  }

  public decodeMsg(msg: any): any {
    let result: any = {};
    if (!msg) {
      return;
    }
    if (msg.typeUrl) {
      result['@type'] = msg.typeUrl;
      const msgType = this.registry.lookupType(
        msg.typeUrl
      ) as TsProtoGeneratedType;
      if (!msgType) {
        const formattedValue =
          msg.value instanceof Uint8Array ? toBase64(msg.value) : msg.value;
        this._logger.info(formattedValue);
        result.value = formattedValue;
        this._logger.error('This typeUrl is not supported');
        this._logger.error(msg.typeUrl);
      } else {
        // Utils.isBase64();
        const decoded: any = msgType.toJSON(
          this.registry.decode({
            typeUrl: msg.typeUrl,
            value: Utils.isBase64(msg.value)
              ? fromBase64(msg.value)
              : msg.value,
          })
        );
        Object.keys(decoded).forEach((key) => {
          if (decoded[key].typeUrl) {
            const resultRecursive = this.decodeMsg(decoded[key]);
            result[key] = resultRecursive;
          } else {
            result[key] = decoded[key];
          }
        });
      }

      // parse JSON some field
      if (
        msg.typeUrl === MSG_TYPE.MSG_EXECUTE_CONTRACT ||
        msg.typeUrl === MSG_TYPE.MSG_INSTANTIATE_CONTRACT ||
        msg.typeUrl === MSG_TYPE.MSG_INSTANTIATE2_CONTRACT
      ) {
        if (result.msg) {
          try {
            result.msg = fromUtf8(fromBase64(result.msg));
          } catch (error) {
            this._logger.error('This msg instantite/execute is not valid JSON');
          }
        }
      } else if (msg.typeUrl === MSG_TYPE.MSG_ACKNOWLEDGEMENT) {
        try {
          result.packet.data = JSON.parse(
            fromUtf8(fromBase64(result.packet.data))
          );
          result.acknowledgement = JSON.parse(
            fromUtf8(fromBase64(result.acknowledgement))
          );
        } catch (error) {
          this._logger.error('This msg ibc acknowledgement is not valid JSON');
        }
      } else if (msg.typeUrl === MSG_TYPE.MSG_AUTHZ_EXEC) {
        try {
          result.msgs = result.msgs.map((subMsg: any) =>
            this.decodeMsg({
              typeUrl: subMsg.typeUrl,
              value: Utils.isBase64(subMsg.value)
                ? fromBase64(subMsg.value)
                : subMsg.value,
            })
          );
        } catch (error) {
          this._logger.error('Cannot decoded sub messages authz exec');
        }
      } else if (msg.typeUrl === MSG_TYPE.MSG_SUBMIT_PROPOSAL_V1) {
        try {
          result.messages = result.messages.map((subMsg: any) =>
            this.decodeMsg({
              typeUrl: subMsg.typeUrl,
              value: Utils.isBase64(subMsg.value)
                ? fromBase64(subMsg.value)
                : subMsg.value,
            })
          );
        } catch (error) {
          this._logger.error('Cannot decoded sub messages in proposal');
        }
      }
    } else {
      result = msg;
    }

    // eslint-disable-next-line consistent-return
    return result;
  }

  public addTypes(types: string[]) {
    types.forEach((type) =>
      this.registry.register(type, _.get(this, type.slice(1)))
    );
  }

  public setCosmosSdkVersionByString(version: string) {
    this.cosmosSdkVersion = new SemVer(version);

    if (this.cosmosSdkVersion.compare('v0.45.99') === -1) {
      this.decodeAttribute = (input: string) => {
        if (!input) {
          return input;
        }
        return fromUtf8(fromBase64(input));
      };
      this.encodeAttribute = (input: string) => toBase64(toUtf8(input));
    } else {
      this.decodeAttribute = (input: string) => input;
      this.encodeAttribute = (input: string) => input;
    }
  }
}
