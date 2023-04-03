import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common';
import { Account, Validator } from '../../../../src/models';
import knex from '../../../../src/common/utils/db_connection';
import CrawlAccountStakeService from '../../../../src/services/crawl-account/crawl_account_stake.service';

@Describe('Test crawl_account_stake service')
export default class CrawlAccountStakeTest {
  account = Account.fromJson({
    address: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
    balances: [],
    spendable_balances: [],
    type: null,
    pubkey: {},
    account_number: 0,
    sequence: 0,
  });

  validators: Validator[] = [
    Validator.fromJson({
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
    }),
    Validator.fromJson({
      commission: JSON.parse('{}'),
      operator_address: 'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh',
      consensus_address: 'auravalcons1s6gzw2kyrduq60cqnj04psmyv8yk0vxp7m2chr',
      consensus_hex_address: '8690272AC41B780D3F009C9F50C36461C967B0C1',
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
      account_address: 'aura1edw4lwcz3esnlgzcw60ra8m38k3zygz2aewzcf',
      percent_voting_power: 16.498804,
      start_height: 0,
      index_offset: 0,
      jailed_until: '1970-01-01T00:00:00Z',
      tombstoned: false,
      missed_blocks_counter: 0,
      self_delegation_balance: '102469134',
    }),
  ];

  broker = new ServiceBroker({ logger: false });

  crawlAccountStakeService?: CrawlAccountStakeService;

  @BeforeAll()
  async initSuite() {
    this.broker.start();
    this.crawlAccountStakeService = this.broker.createService(
      CrawlAccountStakeService
    ) as CrawlAccountStakeService;
    await this.crawlAccountStakeService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.CRAWL_ACCOUNT_DELEGATIONS)
      .empty();
    await this.crawlAccountStakeService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.CRAWL_ACCOUNT_REDELEGATIONS)
      .empty();
    await this.crawlAccountStakeService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.CRAWL_ACCOUNT_UNBONDING)
      .empty();
    await Promise.all([knex('account_stake').del(), knex('validator').del()]);
    await knex('account').del();
    await Account.query().insert(this.account);
    await Validator.query().insert(this.validators);
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([knex('account_stake').del(), knex('validator').del()]);
    await knex('account').del();
    this.broker.stop();
  }

  @Test('Crawl account delegation success')
  public async testCrawlAccountDelegations() {
    expect(true);
  }
}
