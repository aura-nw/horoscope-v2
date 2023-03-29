import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common/constant';
import Block from '../../../../src/models/block';
import Transaction from '../../../../src/models/transaction';
import knex from '../../../../src/common/utils/db_connection';
import CrawlSigningInfoService from '../../../../src/services/crawl-validator/crawl_signing_info.service';
import CrawlValidatorService from '../../../../src/services/crawl-validator/crawl_validator.service';
import { Validator } from '../../../../src/models/validator';

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
          value: 'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx',
        },
      ],
    },
  };

  validator: Validator = Validator.fromJson({
    commission: JSON.parse('{}'),
    operator_address: 'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx',
    consensus_address: 'auravalcons1wep98af7gdsk54d9f0dwapr6qpxkpll5udf62e',
    consensus_hex_address: '764253F53E43616A55A54BDAEE847A004D60FFF4',
    consensus_pubkey: {
      type: '/cosmos.crypto.ed25519.PubKey',
      key: 'UaS9Gv6C+SB7PkbRFag2i8hOvJzFGks1+y5hnd0+C6w=',
    },
    jailed: false,
    status: 'BOND_STATUS_BONDED',
    tokens: '21321285226',
    delegator_shares: '21321285226.000000000000000000',
    description: JSON.parse('{}'),
    unbonding_height: 0,
    unbonding_time: '1970-01-01T00:00:00Z',
    min_self_delegation: '1',
    uptime: 100,
    account_address: 'aura1d3n0v5f23sqzkhlcnewhksaj8l3x7jey8hq0sc',
    percent_voting_power: 16.498804,
    start_height: 0,
    index_offset: 0,
    jailed_until: '1970-01-01T00:00:00Z',
    tombstoned: false,
    missed_blocks_counter: 0,
    self_delegation_balance: '102469134',
  });

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
    await Validator.query().insert(this.validator);
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
          'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh'
      )?.account_address
    ).toEqual('aura1edw4lwcz3esnlgzcw60ra8m38k3zygz2aewzcf');
    expect(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh'
      )?.consensus_address
    ).toEqual('auravalcons1s6gzw2kyrduq60cqnj04psmyv8yk0vxp7m2chr');

    expect(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx'
      )?.account_address
    ).toEqual('aura1d3n0v5f23sqzkhlcnewhksaj8l3x7jey8hq0sc');
    expect(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx'
      )?.consensus_address
    ).toEqual('auravalcons1wep98af7gdsk54d9f0dwapr6qpxkpll5udf62e');
  }
}
