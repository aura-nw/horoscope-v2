/* eslint-disable no-else-return */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker, Errors } from 'moleculer';
import { ethers } from 'ethers';
import _ from 'lodash';
import BaseService from '../../base/base.service';
import EtherJsClient from '../../common/utils/etherjs_client';
import { ContractHelper } from './helpers/contract_helper';
import { EvmProxyHistory, EVMSmartContract } from '../../models';
import { SERVICE } from './constant';

@Service({
  name: SERVICE.V2.EvmProxyService.key,
  version: 2,
})
export default class EVMProxy extends BaseService {
  private etherJsClient!: ethers.AbstractProvider;

  private contractHelper!: ContractHelper;

  public constructor(public broker: ServiceBroker) {
    super(broker);

    this.etherJsClient = new EtherJsClient().etherJsClient;
    this.contractHelper = new ContractHelper(this.etherJsClient);
  }

  @Action({
    name: SERVICE.V2.EvmProxyService.evmProxy.key,
    params: {
      contractAddress: {
        type: 'string',
        required: true,
        normalize: true,
      },
    },
  })
  public async detectEvmProxy(
    ctx: Context<{ contractAddress: string }>
  ): Promise<EvmProxyHistory> {
    const proxyContractRPC = await this.contractHelper.isContractProxy(
      ctx.params.contractAddress
    );

    if (!proxyContractRPC) {
      throw new Errors.ValidationError('Not a proxy contract.');
    }

    let evmProxyHistory!: EvmProxyHistory;
    const proxyContract = await EVMSmartContract.query()
      .findOne('address', ctx.params.contractAddress)
      .withGraphJoined('evm_proxy_histories')
      .orderBy('evm_proxy_histories.updated_at', 'desc');

    if (!proxyContract) {
      // TODO: call evm contract service to add missing proxy contract.
    } else {
      if (!proxyContract.type) {
        await proxyContract.$query().patch({ type: proxyContractRPC.EIP });
      }

      evmProxyHistory = _.find(proxyContract.evm_proxy_histories, {
        implementation_contract: proxyContractRPC.logicContractAddress,
      });

      if (!evmProxyHistory) {
        const currentBlock = await this.etherJsClient.getBlockNumber();

        evmProxyHistory = await EvmProxyHistory.query()
          .insert({
            proxy_contract: ctx.params.contractAddress,
            implementation_contract: proxyContractRPC.logicContractAddress,
            last_updated_height: currentBlock,
            tx_hash: '',
          })
          .returning('*');
      }
    }

    return evmProxyHistory;
  }
}
