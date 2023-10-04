import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common';
import {
  Account,
  Block,
  BlockCheckpoint,
  Transaction,
} from '../../../../src/models';
import CrawlAccountService from '../../../../src/services/crawl-account/crawl_account.service';
import HandleStakeEventService from '../../../../src/services/crawl-validator/handle_stake_event.service';
import HandleAddressService from '../../../../src/services/crawl-account/handle_address.service';
import knex from '../../../../src/common/utils/db_connection';

@Describe('Test handle_address service')
export default class HandleAddressTest {
  blockCheckpoint = [
    BlockCheckpoint.fromJson({
      job_name: BULL_JOB_NAME.HANDLE_ADDRESS,
      height: 3967500,
    }),
    BlockCheckpoint.fromJson({
      job_name: BULL_JOB_NAME.HANDLE_TRANSACTION,
      height: 3967529,
    }),
  ];

  blocks: Block[] = [
    Block.fromJson({
      height: 3967529,
      hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9A',
      time: '2023-01-12T01:53:57.216Z',
      proposer_address: 'auraomd;cvpio3j4eg',
      data: {},
    }),
    Block.fromJson({
      height: 3967530,
      hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9F',
      time: '2023-01-12T01:53:57.216Z',
      proposer_address: 'auraomd;cvpio3j4eg',
      data: {},
    }),
  ];

  txInsert = {
    ...Transaction.fromJson({
      height: 3967530,
      hash: '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997D',
      codespace: '',
      code: 0,
      gas_used: '123035',
      gas_wanted: '141106',
      gas_limit: '141106',
      fee: 353,
      timestamp: '2023-01-12T01:53:57.000Z',
      data: {},
      index: 0,
    }),
    events: [
      {
        tx_msg_index: 0,
        type: 'coin_received',
        attributes: [
          {
            key: 'receiver',
            value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw',
            block_height: 3967529,
            index: 0,
          },
        ],
      },
      {
        tx_msg_index: 0,
        type: 'coin_spent',
        attributes: [
          {
            key: 'spender',
            value: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
            block_height: 3967529,
            index: 0,
          },
        ],
      },
      {
        tx_msg_index: 0,
        type: 'message',
        attributes: [
          {
            key: 'sender',
            value: 'aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx',
            block_height: 3967529,
            index: 0,
          },
        ],
      },
      {
        tx_msg_index: 0,
        type: 'set_grant',
        attributes: [
          {
            key: 'granter',
            value: 'aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n',
            block_height: 3967529,
            index: 0,
          },
          {
            key: 'grantee',
            value: 'aura1v6xeve40f43mc063srml2qe2fsw7ffugtcaaz2',
            block_height: 3967529,
            index: 1,
          },
        ],
      },
    ],
  };

  broker = new ServiceBroker({ logger: false });

  handleAddressService?: HandleAddressService;

  crawlAccountService?: CrawlAccountService;

  handleStakeEventService?: HandleStakeEventService;

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    this.crawlAccountService = this.broker.createService(
      CrawlAccountService
    ) as CrawlAccountService;
    this.handleAddressService = this.broker.createService(
      HandleAddressService
    ) as HandleAddressService;
    this.handleStakeEventService = this.broker.createService(
      HandleStakeEventService
    ) as HandleStakeEventService;
    await this.crawlAccountService.getQueueManager().stopAll();
    await this.handleAddressService.getQueueManager().stopAll();
    await this.handleStakeEventService.getQueueManager().stopAll();

    await Promise.all([
      Account.query().delete(true),
      BlockCheckpoint.query().delete(true),
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
    ]);
    await Block.query().insert(this.blocks);
    await Transaction.query().insertGraph(this.txInsert);
    await BlockCheckpoint.query().insert(this.blockCheckpoint);
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([
      Account.query().delete(true),
      BlockCheckpoint.query().delete(true),
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
    ]);
    await this.broker.stop();
  }

  @Test('Handle address success and insert account to DB')
  public async testHandleAddress() {
    await this.handleAddressService?.handleJob({});

    const accounts = await Account.query();

    expect(
      accounts.find(
        (acc) => acc.address === 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw'
      )
    ).not.toBeUndefined();
    expect(
      accounts.find(
        (acc) => acc.address === 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk'
      )
    ).not.toBeUndefined();
    expect(
      accounts.find(
        (acc) => acc.address === 'aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx'
      )
    ).not.toBeUndefined();
    expect(
      accounts.find(
        (acc) => acc.address === 'aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n'
      )
    ).not.toBeUndefined();
    expect(
      accounts.find(
        (acc) => acc.address === 'aura1v6xeve40f43mc063srml2qe2fsw7ffugtcaaz2'
      )
    ).not.toBeUndefined();
  }
}
