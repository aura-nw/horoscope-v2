import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common/constant';
import knex from '../../../../src/common/utils/db_connection';
import { Validator } from '../../../../src/models/validator';
import CrawlSigningInfoService from '../../../../src/services/crawl-validator/crawl_signing_info.service';

@Describe('Test crawl_signing_info service')
export default class CrawlSigningInfoTest {
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

  crawlSigningInfoService?: CrawlSigningInfoService;

  @BeforeAll()
  async initSuite() {
    this.broker.start();
    this.crawlSigningInfoService = this.broker.createService(
      CrawlSigningInfoService
    ) as CrawlSigningInfoService;
    await this.crawlSigningInfoService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.CRAWL_SIGNING_INFO)
      .empty();
    await knex('validator').del();
    await Validator.query().insert(this.validator);
  }

  @AfterAll()
  async tearDown() {
    await knex('validator').del();
    this.broker.stop();
  }

  @Test('Crawl validator signing info success')
  public async testCrawlSigningInfo() {
    await this.crawlSigningInfoService?.handleJob({
      listAddresses: ['auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx'],
    });

    const updatedValidator = await Validator.query().first();

    expect(updatedValidator?.start_height).toEqual(976);
    expect(updatedValidator?.tombstoned).toEqual(false);
  }
}
