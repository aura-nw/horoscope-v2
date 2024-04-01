/* eslint-disable no-else-return */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker, Errors } from 'moleculer';
import { ethers } from 'ethers';
import { keccak256 } from 'viem';
import BaseService from '../../base/base.service';
import EtherJsClient from '../../common/utils/etherjs_client';
import { SERVICE } from '../../common';
import { ContractHelper } from './helpers/contract_helper';
import { EvmProxyHistory, EVMSmartContract } from '../../models';
import knex from '../../common/utils/db_connection';

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
        trim: true,
        required: true,
      },
      chainId: {
        type: 'string',
        trim: true,
        required: true,
      },
    },
  })
  public async detectEvmProxy(
    ctx: Context<{ chainId: string; contractAddress: string }>
  ): Promise<{ proxyContract: string; implementationContract: string }> {
    const contractAddress = ctx.params.contractAddress.toLowerCase();
    const proxyContractRPC = await this.contractHelper.isContractProxy(
      contractAddress
    );

    if (!proxyContractRPC) {
      throw new Errors.ValidationError('Not a proxy contract.');
    }

    const proxyContract = await EVMSmartContract.query()
      .findOne('address', contractAddress)
      .innerJoin(
        'evm_proxy_history',
        'evm_smart_contract.address',
        'evm_proxy_history.proxy_contract'
      )
      .where('evm_proxy_history.proxy_contract', contractAddress)
      .andWhere(
        'evm_proxy_history.implementation_contract',
        proxyContractRPC.logicContractAddress as string
      )
      .orderBy('evm_proxy_history.updated_at', 'desc')
      .first();

    if (!proxyContract) {
      const [lastUpdatedHeight, code] = await Promise.all([
        this.etherJsClient.getBlockNumber(),
        this.etherJsClient.getCode(contractAddress),
      ]);
      const codeHash = keccak256(code as `0x${string}`);

      await knex.transaction(async (trx) => {
        await EVMSmartContract.query()
          .insert({
            address: contractAddress,
            type: proxyContractRPC.EIP,
            code_hash: codeHash,
          })
          .onConflict('address')
          .merge()
          .transacting(trx);

        await EvmProxyHistory.query()
          .insert({
            proxy_contract: contractAddress,
            implementation_contract: proxyContractRPC.logicContractAddress,
            last_updated_height: lastUpdatedHeight,
            tx_hash: '',
          })
          .transacting(trx);
      });
    }

    return {
      proxyContract: contractAddress,
      implementationContract: proxyContractRPC.logicContractAddress as string,
    };
  }
}
