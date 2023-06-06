/* eslint-disable no-param-reassign */
import { Registry, TsProtoGeneratedType } from '@cosmjs/proto-signing';
import { defaultRegistryTypes as defaultStargateTypes } from '@cosmjs/stargate';
import { wasmTypes } from '@cosmjs/cosmwasm-stargate/build/modules';
import { ibc, cosmos } from '@aura-nw/aurajs';
import { toBase64, fromUtf8, fromBase64 } from '@cosmjs/encoding';
import { LoggerInstance } from 'moleculer';
import _ from 'lodash';
import { MSG_TYPE } from '../../common';
import Utils from '../../common/utils/utils';

export default class AuraRegistry {
  public registry!: Registry;

  private _logger: LoggerInstance;

  public cosmos: any;

  public ibc: any;

  constructor(logger: LoggerInstance) {
    this._logger = logger;
    this.cosmos = cosmos;
    this.ibc = ibc;
    this.setDefaultRegistry();
  }

  // set default registry to decode msg
  public setDefaultRegistry() {
    const missingTypes = [
      // content proposal
      '/cosmos.gov.v1beta1.MsgSubmitProposal',
      '/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal',
      '/cosmos.upgrade.v1beta1.CancelSoftwareUpgradeProposal',
      '/cosmos.distribution.v1beta1.CommunityPoolSpendProposal',
      '/cosmos.distribution.v1beta1.CommunityPoolSpendProposalWithDeposit',
      '/cosmos.params.v1beta1.ParameterChangeProposal',
      '/ibc.core.client.v1.UpgradeProposal',
      '/ibc.core.client.v1.ClientUpdateProposal',
      '/cosmos.params.v1beta1.ParameterChangeProposal',

      // feegrant
      '/cosmos.feegrant.v1beta1.BasicAllowance',
      '/cosmos.feegrant.v1beta1.PeriodicAllowance',
      '/cosmos.feegrant.v1beta1.AllowedContractAllowance',
      '/cosmos.vesting.v1beta1.MsgCreatePeriodicVestingAccount',

      // ibc header
      '/ibc.lightclients.tendermint.v1.Header',
    ];

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const registry = new Registry([
      ...defaultStargateTypes,
      ...wasmTypes,
      ...missingTypes.map((type) => [type, _.get(this, type.slice(1))]),
    ]);

    this.registry = registry;
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
        const decodedBase64 = toBase64(msg.value);
        this._logger.info(decodedBase64);
        result.value = decodedBase64;
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
          if (decoded[key].typeUrl && decoded[key].value) {
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
            result.msg = JSON.parse(fromUtf8(fromBase64(result.msg)));
          } catch (error) {
            this._logger.error('This msg instantite/execute is not valid JSON');
          }
        }
      } else if (msg.typeUrl === MSG_TYPE.MSG_UPDATE_CLIENT) {
        if (result.header?.value && result.header?.typeUrl) {
          // find type header in registry
          const headerType = this.registry.lookupType(
            result.header?.typeUrl
          ) as TsProtoGeneratedType;

          // decode header if found type
          if (headerType) {
            const decoded = headerType.decode(fromBase64(result.header?.value));
            const jsonObjDecoded: any = headerType.toJSON(decoded);
            result.header = {
              '@type': result.header.typeUrl,
              ...jsonObjDecoded,
            };
          } else {
            const decodedBase64 = toBase64(result.header?.value);
            this._logger.info(decodedBase64);
            result.value = decodedBase64;
            this._logger.error('This header is not supported');
            this._logger.error(result.header?.typeUrl);
          }
        }
      } else if (msg.typeUrl === MSG_TYPE.MSG_ACKNOWLEDGEMENT) {
        // Object.assign(result, this.decodeIbcAck(result));
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
      } else if (msg.typeUrl === MSG_TYPE.MSG_GRANT_ALLOWANCE) {
        if (result.allowance?.value && result.allowance?.typeUrl) {
          // find type header in registry
          const allowanceType = this.registry.lookupType(
            result.allowance?.typeUrl
          ) as TsProtoGeneratedType;

          // decode header if found type
          if (allowanceType) {
            const decoded = allowanceType.decode(
              fromBase64(result.allowance?.value)
            );
            const jsonObjDecoded: any = allowanceType.toJSON(decoded);
            result.allowance = {
              '@type': result.allowance.typeUrl,
              ...jsonObjDecoded,
            };
          } else {
            const decodedBase64 = toBase64(result.allowance?.value);
            this._logger.info(decodedBase64);
            result.value = decodedBase64;
            this._logger.error('This feegrant allowance is not supported');
            this._logger.error(result.allowance?.typeUrl);
          }
        }
      } else if (msg.typeUrl === MSG_TYPE.MSG_SUBMIT_PROPOSAL) {
        const proposalType = this.registry.lookupType(
          result.content?.typeUrl
        ) as TsProtoGeneratedType;
        if (proposalType) {
          const decoded = proposalType.decode(
            fromBase64(result.content?.value)
          );
          const jsonObjDecoded: any = proposalType.toJSON(decoded);
          result.content = {
            '@type': result.content.typeUrl,
            ...jsonObjDecoded,
          };
        } else {
          this._logger.error('This proposal content type is not supported');
        }
      }
    } else {
      result = msg;
    }

    // eslint-disable-next-line consistent-return
    return result;
  }
}
