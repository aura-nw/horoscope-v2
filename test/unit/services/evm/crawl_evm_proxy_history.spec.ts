import { AfterAll, BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import { EVMSmartContract, EvmProxyHistory } from '../../../../src/models';
import CrawlProxyContractEVMService from '../../../../src/services/evm/crawl_evm_proxy_history.service';

@Describe('Test EVMProxy')
export default class EvmProxyServiceTest {
  private broker = new ServiceBroker({ logger: false });

  private evmProxyHistoryService!: CrawlProxyContractEVMService;

  @BeforeEach()
  async initSuite() {
    await this.broker.start();
    this.evmProxyHistoryService = this.broker.createService(
      CrawlProxyContractEVMService
    ) as CrawlProxyContractEVMService;
    await knex.raw(
      'TRUNCATE TABLE evm_smart_contract, evm_proxy_history RESTART IDENTITY CASCADE'
    );
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  @Test('Test handleErc20ProxyContracts')
  async testHandleErc20ProxyContracts() {
    const evmSmartContracts = [
      EVMSmartContract.fromJson({
        id: 1,
        address: 'proxy_erc20',
        creator: 'aaaaaaa',
        created_height: 1000,
        created_hash: '',
        type: EVMSmartContract.TYPES.PROXY_EIP_1822,
        code_hash: '',
      }),
      EVMSmartContract.fromJson({
        id: 2,
        address: 'erc20',
        creator: 'dfdfdfdfdzzzz',
        created_height: 1000,
        created_hash: '',
        type: EVMSmartContract.TYPES.ERC20,
        code_hash: '',
      }),
      EVMSmartContract.fromJson({
        id: 3,
        address: 'proxy_erc721',
        creator: 'aaaaaaa',
        created_height: 1000,
        created_hash: '',
        type: EVMSmartContract.TYPES.PROXY_EIP_1822,
        code_hash: '',
      }),
      EVMSmartContract.fromJson({
        id: 4,
        address: 'erc721',
        creator: 'hic',
        created_height: 1000,
        created_hash: '',
        type: EVMSmartContract.TYPES.ERC721,
        code_hash: '',
      }),
    ];
    const evmProxyHistories = [
      EvmProxyHistory.fromJson({
        proxy_contract: evmSmartContracts[0].address,
        implementation_contract: evmSmartContracts[1].address,
        tx_hash: '',
        block_height: 1232,
        last_updated_height: null,
      }),
      EvmProxyHistory.fromJson({
        proxy_contract: evmSmartContracts[2].address,
        implementation_contract: evmSmartContracts[3].address,
        tx_hash: '',
        block_height: 1232,
        last_updated_height: null,
      }),
    ];
    await knex.transaction(async (trx) => {
      await EVMSmartContract.query().insert(evmSmartContracts).transacting(trx);
      const newProxyContracts = await EvmProxyHistory.query()
        .insert(evmProxyHistories)
        .onConflict(['proxy_contract', 'block_height'])
        .merge()
        .returning('id')
        .transacting(trx);
      const result = jest
        .spyOn(this.evmProxyHistoryService.broker, 'call')
        .mockResolvedValue([]);
      await this.evmProxyHistoryService.handleErc20ProxyContracts(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        newProxyContracts,
        trx
      );
      expect(result).toHaveBeenCalledWith('v1.Erc20.insertNewErc20Contracts', {
        evmSmartContracts: [
          {
            address: evmSmartContracts[0].address,
            id: evmSmartContracts[0].id,
            created_height: evmSmartContracts[0].created_height,
          },
        ],
      });
    });
  }
}
