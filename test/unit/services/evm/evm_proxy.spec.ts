import { AfterAll, BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { ethers } from 'ethers';
import EVMProxy from '../../../../src/services/evm/evm_proxy.service';
import { ContractHelper } from '../../../../src/services/evm/helpers/contract_helper';
import { EvmProxyHistory, EVMSmartContract } from '../../../../src/models';
import knex from '../../../../src/common/utils/db_connection';

const ctx: any = {
  params: { contractAddress: '0x0000000000000000000000000000000000000001' },
};
const proxyContractRPC = {
  logicContractAddress: '0x0000000000000000000000000000000000000002',
  EIP: EVMSmartContract.TYPES.PROXY_EIP_1967,
};
const lastBlockHeight = 100;

@Describe('Test EVMProxy')
export default class EvmProxyServiceTest {
  private broker = new ServiceBroker({ logger: false });

  private evmProxyService!: EVMProxy;

  @BeforeEach()
  async initSuite() {
    await this.broker.start();
    this.evmProxyService = this.broker.createService(EVMProxy) as EVMProxy;
    await Promise.all([
      knex.raw('TRUNCATE TABLE evm_smart_contract RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE evm_proxy_history RESTART IDENTITY CASCADE'),
    ]);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Test detectEvmProxy throw validation error')
  async testWithThrowErr() {
    jest
      .spyOn(ContractHelper.prototype, 'isContractProxy')
      .mockResolvedValueOnce(null);

    await expect(this.evmProxyService?.detectEvmProxy(ctx)).rejects.toThrow(
      'Not a proxy contract.'
    );
  }

  @Test('Test detectEvmProxy founded proxy contract history')
  async testWithProxyHistory() {
    jest
      .spyOn(ContractHelper.prototype, 'isContractProxy')
      .mockResolvedValueOnce(proxyContractRPC);

    const insertedSmartContract = await EVMSmartContract.query()
      .insert({ address: ctx.params.contractAddress })
      .returning('*');
    const insertedEvmProxyHistory = await EvmProxyHistory.query()
      .insert({
        proxy_contract: ctx.params.contractAddress,
        implementation_contract: proxyContractRPC.logicContractAddress,
        last_updated_height: lastBlockHeight,
        tx_hash: '',
      })
      .returning('*');

    const evmProxyHistory = await this.evmProxyService?.detectEvmProxy(ctx);
    const updatedProxyContract = await EVMSmartContract.query().findOne(
      'id',
      insertedSmartContract.id
    );

    expect(updatedProxyContract?.type).toBe(proxyContractRPC.EIP);
    expect(evmProxyHistory).toMatchObject(insertedEvmProxyHistory);
  }

  @Test('Test detectEvmProxy not found proxy contract history')
  async testWithoutProxyHistory() {
    jest
      .spyOn(ContractHelper.prototype, 'isContractProxy')
      .mockResolvedValueOnce(proxyContractRPC);
    jest
      .spyOn(ethers.AbstractProvider.prototype, 'getBlockNumber')
      .mockResolvedValueOnce(lastBlockHeight);

    await EVMSmartContract.query()
      .insert({
        address: ctx.params.contractAddress,
        type: EVMSmartContract.TYPES.PROXY_EIP_1967,
      })
      .returning('*');

    const evmProxyHistory = await this.evmProxyService?.detectEvmProxy(ctx);

    expect(evmProxyHistory).not.toBeNull();
  }
}
