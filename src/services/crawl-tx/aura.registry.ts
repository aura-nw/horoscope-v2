import { Registry, GeneratedType } from '@cosmjs/proto-signing';
import { defaultRegistryTypes as defaultStargateTypes } from '@cosmjs/stargate';

import { wasmTypes } from '@cosmjs/cosmwasm-stargate/build/modules';
import { Header } from 'cosmjs-types/ibc/lightclients/tendermint/v1/tendermint';
import {
  BasicAllowance,
  PeriodicAllowance,
} from 'cosmjs-types/cosmos/feegrant/v1beta1/feegrant';
import { cosmos } from '@aura-nw/aurajs';
import { toBase64, fromUtf8 } from '@cosmjs/encoding';
import { LoggerInstance } from 'moleculer';
import { MSG_TYPE } from '../../common';

export default class AuraRegistry {
  public registry!: Registry;

  private _logger: LoggerInstance;

  constructor(logger: LoggerInstance) {
    this._logger = logger;
    this.setDefaultRegistry();
  }

  // set default registry to decode msg
  public setDefaultRegistry() {
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
    registry.register(
      '/cosmos.gov.v1beta1.MsgSubmitProposal',
      cosmos.gov.v1beta1.MsgSubmitProposal as GeneratedType
    );
    this.registry = registry;
  }

  public decodeMsg(msg: any): any {
    const result: any = {};
    if (!msg) {
      return;
    }
    if (msg.typeUrl) {
      result['@type'] = msg.typeUrl;
      const found = this.registry.lookupType(msg.typeUrl);
      if (!found) {
        const decodedBase64 = toBase64(msg.value);
        this._logger.info(decodedBase64);
        result.value = decodedBase64;
        this._logger.error('This typeUrl is not supported');
        this._logger.error(msg.typeUrl);
      } else {
        const decoded = this.registry.decode(msg);

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
          result.header = this.registry.decode(result.header);
        }
      }
    }

    // eslint-disable-next-line consistent-return
    return result;
  }
}
