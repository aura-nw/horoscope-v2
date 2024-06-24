import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import CrawlSmartContractEVMService from '../../../../src/services/evm/crawl_contract_evm.service';
import knex from '../../../../src/common/utils/db_connection';
import {
  BlockCheckpoint,
  EVMSmartContract,
  EvmInternalTransaction,
} from '../../../../src/models';

@Describe('Test crawl contract evm')
export default class CrawlContractEvmTest {
  broker = new ServiceBroker({ logger: false });

  crawlContractEvmService = this.broker.createService(
    CrawlSmartContractEVMService
  ) as CrawlSmartContractEVMService;

  @BeforeAll()
  async initSuite() {
    this.crawlContractEvmService.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE evm_smart_contract RESTART IDENTITY CASCADE'
    );
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  @Test('test handleSelfDestruct')
  async testHandleSelfDestruct() {
    const evmSmartContract = EVMSmartContract.fromJson({
      id: 555,
      address: 'ghghdfgdsgre',
      creator: 'dfgdfbvxcvxgfds',
      created_height: 100,
      created_hash: 'cvxcvcxv',
      type: EVMSmartContract.TYPES.ERC721,
      code_hash: 'dfgdfghf',
    });
    await EVMSmartContract.query().insert(evmSmartContract);
    jest.spyOn(BlockCheckpoint, 'getCheckpoint').mockResolvedValue([
      1,
      2,
      BlockCheckpoint.fromJson({
        job_name: 'dfdsfgsg',
        height: 100,
      }),
    ]);
    const mockSelfDestructQuery: any = {
      select: () => 1,
      joinRelated: () => mockSelfDestructQuery,
      where: () => mockSelfDestructQuery,
      andWhere: () => mockSelfDestructQuery,
      orderBy: () => mockSelfDestructQuery,
    };
    jest
      .spyOn(EvmInternalTransaction, 'query')
      .mockImplementation(() => mockSelfDestructQuery);
  }
}
