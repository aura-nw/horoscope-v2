import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common';
import {
  Account,
  Block,
  BlockCheckpoint,
  Transaction,
  Event,
  EventAttribute,
  TransactionMessage,
} from '../../../../src/models';
import CrawlAccountService from '../../../../src/services/crawl-account/crawl_account.service';
import HandleStakeEventService from '../../../../src/services/crawl-validator/handle_stake_event.service';
import HandleAddressService from '../../../../src/services/crawl-account/handle_address.service';

@Describe('Test handle_address service')
export default class HandleAddressTest {
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
      hash: '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997D',
      codespace: '',
      code: 0,
      gas_used: '123035',
      gas_wanted: '141106',
      gas_limit: '141106',
      fee: 353,
      timestamp: '2023-01-12T01:53:57.000Z',
      data: {},
    }),
    events: [
      {
        tx_msg_index: 0,
        type: 'coin_received',
        attributes: [
          {
            key: 'receiver',
            value: 'aura1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3wd7dmw',
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
          },
        ],
      },
    ],
    messages: {
      index: 0,
      type: '/cosmos.staking.v1beta1',
      sender: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      content: {
        '@type': '/cosmos.staking.v1beta1.MsgDelegate',
        delegator_address: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
        validator_address: 'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx',
        amount: {
          denom: 'utaura',
          amount: '1000000',
        },
      },
    },
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
    await Promise.all([
      this.crawlAccountService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_ACCOUNT_AUTH)
        .empty(),
      this.crawlAccountService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_ACCOUNT_BALANCES)
        .empty(),
      this.crawlAccountService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_ACCOUNT_SPENDABLE_BALANCES)
        .empty(),
      this.crawlAccountService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_VESTING_ACCOUNT)
        .empty(),
      this.handleAddressService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_ADDRESS)
        .empty(),
      this.handleStakeEventService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_STAKE_EVENT)
        .empty(),
    ]);
    await Promise.all([
      Account.query().delete(true),
      TransactionMessage.query().delete(true),
      EventAttribute.query().delete(true),
      BlockCheckpoint.query().delete(true),
    ]);
    await Event.query().delete(true);
    await Transaction.query().delete(true);
    await Block.query().delete(true);
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([
      Account.query().delete(true),
      TransactionMessage.query().delete(true),
      EventAttribute.query().delete(true),
      BlockCheckpoint.query().delete(true),
    ]);
    await Event.query().delete(true);
    await Transaction.query().delete(true);
    await Block.query().delete(true);
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
  }
}
