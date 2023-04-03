import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common';
import { Block, Transaction, Validator } from '../../../../src/models';
import knex from '../../../../src/common/utils/db_connection';
import CrawlSigningInfoService from '../../../../src/services/crawl-validator/crawl_signing_info.service';
import CrawlValidatorService from '../../../../src/services/crawl-validator/crawl_validator.service';

@Describe('Test crawl_validator service')
export default class CrawlValidatorTest {
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
    events: {
      tx_msg_index: 0,
      type: 'delegate',
      attributes: [
        {
          key: 'validator',
          value: 'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg',
        },
      ],
    },
  };

  broker = new ServiceBroker({ logger: false });

  crawlValidatorService?: CrawlValidatorService;

  crawlSigningInfoService?: CrawlSigningInfoService;

  @BeforeAll()
  async initSuite() {
    this.broker.start();
    this.crawlSigningInfoService = this.broker.createService(
      CrawlSigningInfoService
    ) as CrawlSigningInfoService;
    this.crawlValidatorService = this.broker.createService(
      CrawlValidatorService
    ) as CrawlValidatorService;
    await this.crawlSigningInfoService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.CRAWL_SIGNING_INFO)
      .empty();
    await this.crawlValidatorService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.CRAWL_GENESIS_VALIDATOR)
      .empty();
    await this.crawlValidatorService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.CRAWL_VALIDATOR)
      .empty();
    await Promise.all([
      knex('validator').del(),
      knex('transaction_event_attribute').del(),
      knex('block_checkpoint').del(),
    ]);
    await knex('transaction_event').del();
    await knex('transaction').del();
    await knex('block').del();
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([
      knex('validator').del(),
      knex('transaction_event_attribute').del(),
      knex('block_checkpoint').del(),
    ]);
    await knex('transaction_event').del();
    await knex('transaction').del();
    await knex('block').del();
    this.broker.stop();
  }

  @Test('Crawl validator info success')
  public async testCrawlValidator() {
    await this.crawlValidatorService?.handleCrawlAllValidator({});

    const validators = await Validator.query();

    expect(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg'
      )?.account_address
    ).toEqual('aura1phaxpevm5wecex2jyaqty2a4v02qj7qmvkxyqk');
    expect(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg'
      )?.consensus_address
    ).toEqual('auravalcons1rvq6km74pua3pt9g7u5svm4r6mrw8z08walfep');
  }
}
