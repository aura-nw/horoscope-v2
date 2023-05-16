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
      }
    }

    // eslint-disable-next-line consistent-return
    return result;
  }

  decodeIbcHeader(header: Header) {
    let decodedIbcHeader: any = { ...header };
    decodedIbcHeader = {
      signedHeader: {
        header: {
          height: header.signedHeader?.header?.height.toString(),
          version: {
            app: header.signedHeader?.header?.version?.app.toString(),
            block: header.signedHeader?.header?.version?.block.toString(),
          },

          appHash: header.signedHeader?.header?.appHash
            ? toBase64(header.signedHeader?.header?.appHash)
            : null,
          dataHash: header.signedHeader?.header?.dataHash
            ? toBase64(header.signedHeader?.header?.dataHash)
            : null,
          evidenceHash: header.signedHeader?.header?.evidenceHash
            ? toBase64(header.signedHeader?.header?.evidenceHash)
            : null,
          lastBlockId: {
            hash: header.signedHeader?.header?.lastBlockId?.hash
              ? toBase64(header.signedHeader?.header?.lastBlockId?.hash)
              : null,
            partSetHeader: {
              hash: header.signedHeader?.header?.lastBlockId?.partSetHeader
                ?.hash
                ? toBase64(
                    header.signedHeader?.header?.lastBlockId?.partSetHeader
                      ?.hash
                  )
                : null,
              total:
                header.signedHeader?.header?.lastBlockId?.partSetHeader?.total,
            },
          },
          consensusHash: header.signedHeader?.header?.consensusHash
            ? toBase64(header.signedHeader?.header?.consensusHash)
            : null,
          validatorsHash: header.signedHeader?.header?.validatorsHash
            ? toBase64(header.signedHeader?.header?.validatorsHash)
            : null,
          lastCommitHash: header.signedHeader?.header?.lastCommitHash
            ? toBase64(header.signedHeader?.header?.lastCommitHash)
            : null,
          proposerAddress: header.signedHeader?.header?.proposerAddress
            ? toBase64(header.signedHeader?.header?.proposerAddress)
            : null,
          lastResultsHash: header.signedHeader?.header?.lastResultsHash
            ? toBase64(header.signedHeader?.header?.lastResultsHash)
            : null,
          nextValidatorsHash: header.signedHeader?.header?.nextValidatorsHash
            ? toBase64(header.signedHeader?.header?.nextValidatorsHash)
            : null,
        },
        commit: {
          round: header.signedHeader?.commit?.round,
          height: header.signedHeader?.commit?.height.toString(),
          blockId: {
            hash: header.signedHeader?.commit?.blockId?.hash
              ? toBase64(header.signedHeader?.commit?.blockId?.hash)
              : null,
            partSetHeader: {
              hash: header.signedHeader?.commit?.blockId?.partSetHeader?.hash
                ? toBase64(
                    header.signedHeader?.commit?.blockId?.partSetHeader?.hash
                  )
                : null,
              total: header.signedHeader?.commit?.blockId?.partSetHeader?.total,
            },
          },
          signatures: decodedIbcHeader.signedHeader?.commit?.signatures.map(
            (sig: any) => ({
              ...sig,
              signature: toBase64(sig.signature),
              validatorAddress: toBase64(sig.validatorAddress),
            })
          ),
        },
      },
      validatorSet: {
        proposer: {
          address: header.validatorSet?.proposer?.address
            ? toBase64(header.validatorSet?.proposer?.address)
            : null,
          pubKey: {
            ed25519: header.validatorSet?.proposer?.pubKey?.ed25519
              ? toBase64(header.validatorSet?.proposer?.pubKey?.ed25519)
              : null,
            secp256k1: header.validatorSet?.proposer?.pubKey?.secp256k1
              ? toBase64(header.validatorSet?.proposer?.pubKey?.secp256k1)
              : null,
          },
          votingPower: header.validatorSet?.proposer?.votingPower.toString(),
          proposerPriority:
            header.validatorSet?.proposer?.proposerPriority.toString(),
        },
        validators: decodedIbcHeader.validatorSet?.validators.map(
          (val: any) => ({
            ...val,
            address: val.address ? toBase64(val.address) : null,
            pubKey: {
              ed25519: val.pubKey?.ed25519
                ? toBase64(val.pubKey?.ed25519)
                : null,
              secp256k1: val.pubKey?.secp256k1
                ? toBase64(val.pubKey?.secp256k1)
                : null,
            },
            votingPower: val.votingPower.toString(),
            proposerPriority: val.proposerPriority.toString(),
          })
        ),
        totalVotingPower: header.validatorSet?.totalVotingPower.toString(),
      },
      trustedHeight: {
        revisionNumber: header.trustedHeight?.revisionNumber.toString(),
        revisionHeight: header.trustedHeight?.revisionHeight.toString(),
      },
      trustedValidators: {
        proposer: {
          address: header.trustedValidators?.proposer?.address
            ? toBase64(header.trustedValidators?.proposer?.address)
            : null,
          pubKey: {
            ed25519: header.trustedValidators?.proposer?.pubKey?.ed25519
              ? toBase64(header.trustedValidators?.proposer?.pubKey?.ed25519)
              : null,
            secp256k1: header.trustedValidators?.proposer?.pubKey?.secp256k1
              ? toBase64(header.trustedValidators?.proposer?.pubKey?.secp256k1)
              : null,
          },
          votingPower:
            header.trustedValidators?.proposer?.votingPower.toString(),
          proposerPriority:
            header.trustedValidators?.proposer?.proposerPriority.toString(),
        },
        validators: decodedIbcHeader.trustedValidators?.validators.map(
          (val: any) => ({
            ...val,
            address: val.address ? toBase64(val.address) : null,
            pubKey: {
              ed25519: val.pubKey?.ed25519
                ? toBase64(val.pubKey?.ed25519)
                : null,
              secp256k1: val.pubKey?.secp256k1
                ? toBase64(val.pubKey?.secp256k1)
                : null,
            },
            votingPower: val.votingPower.toString(),
            proposerPriority: val.proposerPriority.toString(),
          })
        ),
        totalVotingPower: header.trustedValidators?.totalVotingPower.toString(),
      },
    };
    return decodedIbcHeader;
  }
}
