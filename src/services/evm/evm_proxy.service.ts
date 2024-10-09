/* eslint-disable no-else-return */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import _ from 'lodash';
import { Context, Errors, ServiceBroker } from 'moleculer';
import { PublicClient } from 'viem';
import BaseService from '../../base/base.service';
import { getViemClient } from '../../common/utils/etherjs_client';
import { EVMSmartContract, EvmProxyHistory } from '../../models';
import { SERVICE } from './constant';
import { ContractHelper } from './helpers/contract_helper';

@Service({
  name: SERVICE.V2.EvmProxyService.key,
  version: 2,
})
export default class EVMProxy extends BaseService {
  viemClient!: PublicClient;

  private contractHelper!: ContractHelper;

  public constructor(public broker: ServiceBroker) {
    super(broker);

    this.viemClient = getViemClient();
    this.contractHelper = new ContractHelper(this.viemClient);
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
        const currentBlock = await this.viemClient.getBlockNumber();

        evmProxyHistory = await EvmProxyHistory.query()
          .insert({
            proxy_contract: ctx.params.contractAddress,
            implementation_contract: proxyContractRPC.logicContractAddress,
            last_updated_height: currentBlock,
            tx_hash: '',
          })
          .returning('*');
      }
      await this.broker.call(
        SERVICE.V1.CrawlEvmProxyHistory.handleTypeProxyContracts.path,
        {
          proxyHistoryIds: [evmProxyHistory.id],
        }
      );
    }

    return evmProxyHistory;
  }
}
