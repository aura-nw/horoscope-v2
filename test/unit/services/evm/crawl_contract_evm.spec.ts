import {
  AfterAll,
  BeforeAll,
  BeforeEach,
  Describe,
  Test,
} from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { hexToBytes } from 'viem';
import knex from '../../../../src/common/utils/db_connection';
import {
  BlockCheckpoint,
  EVMSmartContract,
  EVMTransaction,
  EvmInternalTransaction,
} from '../../../../src/models';
import { BULL_JOB_NAME } from '../../../../src/services/evm/constant';
import CrawlSmartContractEVMService from '../../../../src/services/evm/crawl_contract_evm.service';

const evmSmartContract = EVMSmartContract.fromJson({
  id: 555,
  address: '0xc57dc0ffa86aefbdd1b3f30e825fcae878a155f6',
  creator: '0xDF587daaC47ae7B5586E34bCdb23d0b900b18a6C',
  created_height: 100,
  created_hash:
    '0xae4b0793937b440f566ba5bdec4d3728a5c26cfc3233ca3a104ff0963841ac92',
  type: EVMSmartContract.TYPES.ERC721,
  code_hash:
    '0xaf7378ea38b2c744796688746c4234e253647da6d8e7325a36f69c1ac0e53d2c',
  total_tx_to: 25,
  last_updated_tx_id: 5968,
});
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
  }

  @BeforeEach()
  async beforeEach() {
    await knex.raw(
      'TRUNCATE TABLE evm_smart_contract, block_checkpoint, evm_transaction RESTART IDENTITY CASCADE'
    );
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  @Test.only('test handleEvmSmartContractTx')
  async testHandleEvmSmartContractTx() {
    const blockHeight = 1233;
    const blockCheckpoints = [
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_EVM_SMART_CONTRACT_TX,
        height: blockHeight - 1,
      }),
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.CRAWL_SMART_CONTRACT_EVM,
        height: blockHeight,
      }),
    ];
    const evmTxs = [
      EVMTransaction.fromJson({
        height: blockHeight,
        to: hexToBytes(evmSmartContract.address as `0x${string}`),
        index: 0,
        hash: '0xeb6835058be18f6a13be74af2d06abbca46cdbd305aa4d378144d520310e8411',
      }),
      EVMTransaction.fromJson({
        height: blockHeight,
        to: hexToBytes(evmSmartContract.address as `0x${string}`),
        index: 1,
        hash: '0xeb6835058be18f6a13be74af2d06abbca46cdbd305aa4d378144d520310e8411',
      }),
      EVMTransaction.fromJson({
        height: blockHeight,
        from: hexToBytes(evmSmartContract.address as `0x${string}`),
        index: 2,
        hash: '0xeb6835058be18f6a13be74af2d06abbca46cdbd305aa4d378144d520310e8411',
      }),
      EVMTransaction.fromJson({
        height: blockHeight,
        to: hexToBytes(evmSmartContract.address as `0x${string}`),
        index: 3,
        hash: '0xeb6835058be18f6a13be74af2d06abbca46cdbd305aa4d378144d520310e8411',
      }),
    ];
    await BlockCheckpoint.query().insert(blockCheckpoints);
    await EVMSmartContract.query().insert(evmSmartContract);
    await EVMTransaction.query().insert(evmTxs);
    await this.crawlContractEvmService.handleEvmSmartContractTx();
    const updatedEvmSmartContract = await EVMSmartContract.query()
      .first()
      .throwIfNotFound();
    expect(updatedEvmSmartContract.total_tx_to).toEqual(
      evmSmartContract.total_tx_to + evmTxs.length - 1
    );
  }

  @Test('test handleSelfDestruct')
  async testHandleSelfDestruct() {
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
    const mockTxQuery: any = {
      select: () => mockTxQuery,
      limit: () => ({ id: 1 }),
      findOne: () => mockTxQuery,
      orderBy: () => mockTxQuery,
    };
    jest.spyOn(EVMTransaction, 'query').mockImplementation(() => mockTxQuery);
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
