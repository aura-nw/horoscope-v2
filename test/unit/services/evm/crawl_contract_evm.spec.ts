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
      address: '0xC57dC0FFa86AEFbdD1b3F30E825fcAE878A155F6',
      creator: '0xDF587daaC47ae7B5586E34bCdb23d0b900b18a6C',
      created_height: 100,
      created_hash:
        '0xae4b0793937b440f566ba5bdec4d3728a5c26cfc3233ca3a104ff0963841ac92',
      type: EVMSmartContract.TYPES.ERC721,
      code_hash:
        '0xaf7378ea38b2c744796688746c4234e253647da6d8e7325a36f69c1ac0e53d2c',
      last_updated_tx_id: 5968,
    });
    await EVMSmartContract.query().insert(evmSmartContract);
    jest.spyOn(BlockCheckpoint, 'getCheckpoint').mockResolvedValue([
      1,
      2,
      BlockCheckpoint.fromJson({
        job_name: 'handle:self_destruct',
        height: 100,
      }),
    ]);
    const selfDestructEvents = [
      EvmInternalTransaction.fromJson({
        from: evmSmartContract.address,
        gas: '0',
        gas_used: '0',
        evm_tx_id: 5969,
        input: '0x',
        to: '0xe1fb381d6fe4ebd25d38929fa7e4c00de2ccd2b2',
        type: 'SELFDESTRUCT',
        type_trace_address: 'CALL[0]_SELFDESTRUCT',
        value: '0',
        height: evmSmartContract.created_height,
      }),
    ];
    const mockSelfDestructQuery: any = {
      select: () => mockSelfDestructQuery,
      joinRelated: () => mockSelfDestructQuery,
      where: () => mockSelfDestructQuery,
      andWhere: () => mockSelfDestructQuery,
      orderBy: () => selfDestructEvents,
    };
    jest
      .spyOn(EvmInternalTransaction, 'query')
      .mockImplementation(() => mockSelfDestructQuery);
    await this.crawlContractEvmService.handleSelfDestruct();
    const result = await EVMSmartContract.query()
      .where('address', evmSmartContract.address)
      .first()
      .throwIfNotFound();
    expect(result.status).toEqual(EVMSmartContract.STATUS.DELETED);
  }
}
