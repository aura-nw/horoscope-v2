import { Registry, GeneratedType } from '@cosmjs/proto-signing';
import { defaultRegistryTypes as defaultStargateTypes } from '@cosmjs/stargate';

import { wasmTypes } from '@cosmjs/cosmwasm-stargate/build/modules';
import { Header } from 'cosmjs-types/ibc/lightclients/tendermint/v1/tendermint';
import {
  BasicAllowance,
  PeriodicAllowance,
} from 'cosmjs-types/cosmos/feegrant/v1beta1/feegrant';
import { cosmos } from '@aura-nw/aurajs';

export default class AuraRegistry {
  public registry!: Registry;

  constructor() {
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
}
