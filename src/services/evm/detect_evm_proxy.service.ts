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

@Service({
  name: SERVICE.V2.DetectEvmProxyService.key,
  version: 2,
})
export default class DetectEVMProxy extends BaseService {
  private etherJsClient!: ethers.AbstractProvider;

  private contractHelper!: ContractHelper;

  public constructor(public broker: ServiceBroker) {
    super(broker);

    this.etherJsClient = new EtherJsClient().etherJsClient;
    this.contractHelper = new ContractHelper(this.etherJsClient);
  }

  @Action({
    name: SERVICE.V2.DetectEvmProxyService.detectEvmProxy.key,
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
    const implContractInfo = await this.contractHelper.isContractProxy(
      contractAddress
    );

    if (!implContractInfo) {
      throw new Errors.ValidationError('Not a proxy contract.');
    }

    const implementationContract =
      implContractInfo.logicContractAddress as string;

    const proxyInDb = await EVMSmartContract.query().findOne(
      'address',
      contractAddress
    );

    if (proxyInDb) {
      const proxyHistory = await EvmProxyHistory.query()
        .where('proxy_contract', contractAddress)
        .andWhere('implementation_contract', implementationContract)
        .orderBy('created_at', 'DESC')
        .first();

      if (!proxyHistory) {
        await this.createEvmProxyHistory(
          contractAddress,
          implementationContract
        );
      }
    } else {
      const code = await this.etherJsClient.getCode(contractAddress);
      const codeHash = keccak256(code as `0x${string}`);
      await EVMSmartContract.query().insert(
        EVMSmartContract.fromJson({
          address: contractAddress,
          type: implContractInfo.EIP,
          code_hash: codeHash,
        })
      );
      await this.createEvmProxyHistory(contractAddress, implementationContract);
    }

    return {
      proxyContract: contractAddress,
      implementationContract,
    };
  }

  private async createEvmProxyHistory(
    proxy_contract: string,
    implementation_contract: string
  ): Promise<void> {
    const lastUpdatedHeight = await this.etherJsClient.getBlockNumber();
    await EvmProxyHistory.query().insert(
      EvmProxyHistory.fromJson({
        proxy_contract,
        implementation_contract,
        last_updated_height: lastUpdatedHeight,
        tx_hash: '',
      })
    );
  }
}
