/* eslint-disable no-param-reassign */
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
import { MsgAcknowledgement } from '@aura-nw/aurajs/types/codegen/ibc/core/channel/v1/tx';
import _ from 'lodash';
import { fromTimestamp } from 'cosmjs-types/helpers';
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
          result.header = this.decodeIbcHeader(
            this.registry.decode(result.header)
          );
        }
      } else if (msg.typeUrl === MSG_TYPE.MSG_ACKNOWLEDGEMENT) {
        Object.assign(result, this.decodeIbcAck(result));
      }
    }

    // eslint-disable-next-line consistent-return
    return result;
  }

  decodeIbcHeader(header: Header) {
    const decodedIbcHeader: any = { ...header };
    [
      'signedHeader.header.height',
      'signedHeader.header.version.app',
      'signedHeader.header.version.block',
      'signedHeader.header.lastBlockId.partSetHeader.total',
      'signedHeader.commit.round',
      'signedHeader.commit.height',
      'signedHeader.commit.blockId.partSetHeader.total',
      'validatorSet.proposer.votingPower',
      'validatorSet.proposer.proposerPriority',
      'validatorSet.totalVotingPower',
      'trustedHeight.revisionNumber',
      'trustedHeight.revisionHeight',
      'trustedValidators.proposer.votingPower',
      'trustedValidators.proposer.proposerPriority',
      'trustedValidators.totalVotingPower',
    ].forEach((key) => {
      _.set(decodedIbcHeader, key, _.get(decodedIbcHeader, key)?.toString());
    });

    [
      'signedHeader.header.appHash',
      'signedHeader.header.dataHash',
      'signedHeader.header.evidenceHash',
      'signedHeader.header.lastBlockId.hash',
      'signedHeader.header.lastBlockId.partSetHeader.hash',
      'signedHeader.header.consensusHash',
      'signedHeader.header.validatorsHash',
      'signedHeader.header.lastCommitHash',
      'signedHeader.header.proposerAddress',
      'signedHeader.header.lastResultsHash',
      'signedHeader.header.nextValidatorsHash',
      'signedHeader.commit.blockId.hash',
      'signedHeader.commit.blockId.partSetHeader.hash',
      'validatorSet.proposer.address',
      'validatorSet.proposer.pubKey.ed25519',
      'validatorSet.proposer.pubKey.secp256k1',
      'trustedValidators.proposer.address',
      'trustedValidators.proposer.pubKey.ed25519',
      'trustedValidators.proposer.pubKey.secp256k1',
    ].forEach((key) => {
      _.set(
        decodedIbcHeader,
        key,
        _.get(decodedIbcHeader, key)
          ? toBase64(_.get(decodedIbcHeader, key))
          : null
      );
    });

    decodedIbcHeader.signedHeader?.commit?.signatures.forEach(
      (sig: any, index: number, sigs: any) => {
        sigs[index] = {
          ...sig,
          signature: toBase64(sig.signature),
          validatorAddress: toBase64(sig.validatorAddress),
        };
      }
    );
    decodedIbcHeader.validatorSet?.validators.forEach(
      (val: any, index: number, vals: any) => {
        vals[index] = {
          ...val,
          address: val?.address ? toBase64(val.address) : null,
          pubKey: {
            ed25519: val?.pubKey?.ed25519
              ? toBase64(val?.pubKey?.ed25519)
              : null,
            secp256k1: val?.pubKey?.secp256k1
              ? toBase64(val?.pubKey?.secp256k1)
              : null,
          },
          votingPower: val?.votingPower?.toString(),
          proposerPriority: val?.proposerPriority?.toString(),
        };
      }
    );
    decodedIbcHeader.trustedValidators?.validators.forEach(
      (val: any, index: number, vals: any) => {
        vals[index] = {
          ...val,
          address: val?.address ? toBase64(val?.address) : null,
          pubKey: {
            ed25519: val?.pubKey?.ed25519
              ? toBase64(val?.pubKey?.ed25519)
              : null,
            secp256k1: val?.pubKey?.secp256k1
              ? toBase64(val?.pubKey?.secp256k1)
              : null,
          },
          votingPower: val?.votingPower?.toString(),
          proposerPriority: val?.proposerPriority?.toString(),
        };
      }
    );

    decodedIbcHeader.signedHeader.header.time = decodedIbcHeader.signedHeader
      ?.header?.time
      ? fromTimestamp(decodedIbcHeader.signedHeader?.header?.time)
      : null;
    return decodedIbcHeader;
  }

  decodeIbcAck(msg: MsgAcknowledgement) {
    const decodedIbcAck: any = { ...msg };
    ['packet.data', 'acknowledgement'].forEach((key) => {
      _.set(
        decodedIbcAck,
        key,
        _.get(decodedIbcAck, key)
          ? JSON.parse(fromUtf8(_.get(decodedIbcAck, key)))
          : null
      );
    });
    [
      'packet.sequence',
      'packet.timeoutHeight.revisionHeight',
      'packet.timeoutHeight.revisionNumber',
      'packet.timeoutTimestamp',
      'proofHeight.revisionHeight',
      'proofHeight.revisionNumber',
    ].forEach((key) => {
      _.set(decodedIbcAck, key, _.get(decodedIbcAck, key)?.toString() ?? null);
    });

    ['proofAcked'].forEach((key) => {
      _.set(
        decodedIbcAck,
        key,
        _.get(decodedIbcAck, key) ? toBase64(_.get(decodedIbcAck, key)) : null
      );
    });

    return decodedIbcAck;
  }
}
