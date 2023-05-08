import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common';
import { Validator } from '../../../../src/models';
import CrawlSigningInfoService from '../../../../src/services/crawl-validator/crawl_signing_info.service';

@Describe('Test crawl_signing_info service')
export default class CrawlSigningInfoTest {
  validator: Validator = Validator.fromJson({
    commission: JSON.parse('{}'),
    operator_address: 'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg',
    consensus_address: 'auravalcons1rvq6km74pua3pt9g7u5svm4r6mrw8z08walfep',
    consensus_hex_address: '1B01AB6FD50F3B10ACA8F729066EA3D6C6E389E7',
    consensus_pubkey: {
      type: '/cosmos.crypto.ed25519.PubKey',
      key: 'AtzgNPEcMZlcSTaWjGO5ymvQ9/Sjp8N68/kJrx0ASI0=',
    },
    jailed: false,
    status: 'BOND_STATUS_BONDED',
    tokens: '100000000',
    delegator_shares: '100000000.000000000000000000',
    description: {
      moniker: 'mynode',
      identity: '',
      website: '',
      security_contact: '',
      details: '',
    },
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
    await this.broker.start();
    this.crawlSigningInfoService = this.broker.createService(
      CrawlSigningInfoService
    ) as CrawlSigningInfoService;
    await this.crawlSigningInfoService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.CRAWL_SIGNING_INFO)
      .empty();
    await Validator.query().delete(true);
    await Validator.query().insert(this.validator);
  }

  @AfterAll()
  async tearDown() {
    await Validator.query().delete(true);
    await this.broker.stop();
  }

  @Test('Crawl validator signing info success')
  public async testCrawlSigningInfo() {
    await this.crawlSigningInfoService?.handleJob({});

    const updatedValidator = await Validator.query().first();

    expect(updatedValidator?.start_height).toEqual(0);
    expect(updatedValidator?.tombstoned).toEqual(false);
  }
}
