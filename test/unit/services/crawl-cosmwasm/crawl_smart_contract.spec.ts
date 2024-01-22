import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { BULL_JOB_NAME } from '../../../../src/common';
import {
  Block,
  BlockCheckpoint,
  Code,
  SmartContract,
  Transaction,
} from '../../../../src/models';
import knex from '../../../../src/common/utils/db_connection';
import CrawlSmartContractService from '../../../../src/services/crawl-cosmwasm/crawl_smart_contract.service';

@Describe('Test crawl_smart_contract service')
export default class CrawlSmartContractTest {
  blockCheckpoint = [
    BlockCheckpoint.fromJson({
      job_name: BULL_JOB_NAME.CRAWL_CODE,
      height: 3968600,
    }),
    BlockCheckpoint.fromJson({
      job_name: BULL_JOB_NAME.HANDLE_MIGRATE_CONTRACT,
      height: 3967500,
    }),
  ];

  block: Block = Block.fromJson({
    height: 3967530,
    hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9F',
    time: '2023-01-12T01:53:57.216Z',
    proposer_address: 'auraomd;cvpio3j4eg',
    data: {},
  });

  txInsert = {
    ...Transaction.fromJson({
      height: 3967530,
      hash: '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997E',
      codespace: '',
      code: 0,
      gas_used: '123035',
      gas_wanted: '141106',
      gas_limit: '141106',
      fee: 353,
      timestamp: '2023-01-12T01:53:57.000Z',
      index: 0,
      data: {},
    }),
    events: [
      {
        tx_msg_index: 0,
        type: 'migrate',
        attributes: [
          {
            key: '_contract_address',
            value:
              'aura14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9swserkw',
            index: 0,
            block_height: 3967530,
          },
          {
            key: 'code_id',
            value: '2',
            index: 1,
            block_height: 3967530,
          },
        ],
      },
    ],
  };

  code = [
    Code.fromJson({
      code_id: 1,
      creator: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      data_hash:
        '4169b4ca795d68de7c112b23b3526c082f788cb3d374a286eb99cf29f5173392',
      instantiate_permission: {
        permission: '3',
        address: '',
        addresses: [],
      },
      type: null,
      status: null,
      store_hash:
        '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997D',
      store_height: 1,
    }),
    Code.fromJson({
      code_id: 2,
      creator: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      data_hash:
        '4169b4ca795d68de7c112b23b3526c082f788cb3d374a286eb99cf29f5173393',
      instantiate_permission: {
        permission: '3',
        address: '',
        addresses: [],
      },
      type: null,
      status: null,
      store_hash:
        '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997E',
      store_height: 3967530,
    }),
  ];

  contract = [
    SmartContract.fromJson({
      name: 'crates.io:cw20-base',
      address:
        'aura14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9swserkw',
      creator: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      code_id: 1,
      status: SmartContract.STATUS.LATEST,
      instantiate_hash:
        '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997D',
      instantiate_height: 3967520,
      version: '0.16.0',
    }),
    SmartContract.fromJson({
      name: 'crates.io:cw721-base',
      address:
        'aura14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9swseras',
      creator: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      code_id: 2,
      status: SmartContract.STATUS.LATEST,
      instantiate_hash:
        '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997D',
      instantiate_height: 3967520,
      version: '0.19.0',
    }),
  ];

  broker = new ServiceBroker({ logger: false });

  crawlSmartContractService?: CrawlSmartContractService;

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    this.crawlSmartContractService = this.broker.createService(
      CrawlSmartContractService
    ) as CrawlSmartContractService;
    this.crawlSmartContractService.getQueueManager().stopAll();
    await Promise.all([
      knex.raw(
        'TRUNCATE TABLE block, transaction, event RESTART IDENTITY CASCADE'
      ),
      knex.raw('TRUNCATE TABLE code RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
    ]);
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
    await BlockCheckpoint.query().insert(this.blockCheckpoint);
    await Code.query().insert(this.code);
    await SmartContract.query().insert(this.contract);
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([
      knex.raw(
        'TRUNCATE TABLE block, transaction, event RESTART IDENTITY CASCADE'
      ),
      knex.raw('TRUNCATE TABLE code RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
    ]);
    await this.broker.stop();
  }

  @Test('Handle migrated smart contract success')
  public async testHandleMigratedContract() {
    await this.crawlSmartContractService?.handleMigrateContract({});

    const migratedContract = await SmartContract.query().where(
      'address',
      'aura14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9swserkw'
    );

    expect(
      _.omit(
        migratedContract.find(
          (contract) => contract.status === SmartContract.STATUS.LATEST
        ),
        ['id', 'created_at', 'updated_at']
      )
    ).toEqual({
      name: 'crates.io:cw721-base',
      address:
        'aura14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9swserkw',
      creator: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      code_id: 2,
      status: SmartContract.STATUS.LATEST,
      instantiate_hash:
        '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997E',
      instantiate_height: 3967530,
      version: '0.19.0',
      label: '',
    });
    expect(
      _.omit(
        migratedContract.find(
          (contract) => contract.status === SmartContract.STATUS.MIGRATED
        ),
        ['id', 'created_at', 'updated_at']
      )
    ).toEqual({
      name: 'crates.io:cw20-base',
      address:
        'aura14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9swserkw',
      creator: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      code_id: 1,
      status: SmartContract.STATUS.MIGRATED,
      instantiate_hash:
        '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997D',
      instantiate_height: 3967520,
      version: '0.16.0',
      label: '',
    });
  }
}
