import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { DirectSecp256k1HdWallet, coins } from '@cosmjs/proto-signing';
import {
  SigningStargateClient,
  assertIsDeliverTxSuccess,
} from '@cosmjs/stargate';
import _ from 'lodash';
import { BULL_JOB_NAME } from '../../../../src/common';
import { BlockCheckpoint, Delegator, Validator } from '../../../../src/models';
import CrawlDelegatorsService from '../../../../src/services/crawl-validator/crawl_delegators.service';
import config from '../../../../config.json' assert { type: 'json' };
import network from '../../../../network.json' assert { type: 'json' };
import {
  defaultSendFee,
  defaultSigningClientOptions,
} from '../../../helper/constant';
import knex from '../../../../src/common/utils/db_connection';

@Describe('Test crawl_delegators service')
export default class CrawlDelegatorsTest {
  blockCheckpoint = BlockCheckpoint.fromJson({
    job_name: BULL_JOB_NAME.CRAWL_BLOCK,
    height: 3967500,
  });

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
    delegators_count: 0,
    delegators_last_height: 0,
  });

  broker = new ServiceBroker({ logger: false });

  crawlDelegatorsService?: CrawlDelegatorsService;

  @BeforeAll()
  async initSuite() {
    await Promise.all([
      knex.raw('TRUNCATE TABLE validator RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
    ]);
    await this.broker.start();
    this.crawlDelegatorsService = this.broker.createService(
      CrawlDelegatorsService
    ) as CrawlDelegatorsService;
    this.crawlDelegatorsService.getQueueManager().stopAll();
    await Promise.all([
      Validator.query().insert(this.validator),
      BlockCheckpoint.query().insert(this.blockCheckpoint),
    ]);
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([
      knex.raw('TRUNCATE TABLE validator RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
    ]);
    await this.broker.stop();
  }

  @Test('Crawl validator delegators success')
  public async testCrawlValidatorDelegators() {
    const amount = coins(2000000, 'uaura');
    const memo = 'test delegate and crawl validator delegators';

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
      'symbol force gallery make bulk round subway violin worry mixture penalty kingdom boring survey tool fringe patrol sausage hard admit remember broken alien absorb',
      {
        prefix: 'aura',
      }
    );
    const client = await SigningStargateClient.connectWithSigner(
      network.find((net) => net.chainId === config.chainId)?.RPC[0] ?? '',
      wallet,
      defaultSigningClientOptions
    );

    let result = await client.delegateTokens(
      'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg',
      amount[0],
      defaultSendFee,
      memo
    );
    assertIsDeliverTxSuccess(result);

    const validator = await Validator.query().first();

    await this.crawlDelegatorsService?.handleJobCrawlValidatorDelegators({
      id: validator?.id ?? 1,
      address: validator?.operator_address ?? '',
      height: validator?.delegators_last_height ?? 0,
    });

    const [updatedValidator, delegators] = await Promise.all([
      Validator.query().first(),
      Delegator.query(),
    ]);

    expect(updatedValidator?.delegators_count).toEqual(2);
    expect(updatedValidator?.delegators_last_height).toEqual(3967500);

    expect(
      _.omit(
        delegators.find(
          (del) =>
            del.delegator_address ===
            'aura1phaxpevm5wecex2jyaqty2a4v02qj7qmvkxyqk'
        ),
        ['id']
      )
    ).toEqual({
      validator_id: updatedValidator?.id,
      delegator_address: 'aura1phaxpevm5wecex2jyaqty2a4v02qj7qmvkxyqk',
      amount: '100000000',
    });

    result = await client.undelegateTokens(
      'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg',
      amount[0],
      defaultSendFee,
      memo
    );
    assertIsDeliverTxSuccess(result);
  }

  @Test('Remove not exist validator delegators success')
  public async testRemoveValidatorDelegators() {
    const amount = coins(2000000, 'uaura');
    const memo = 'test undelegate and remove not exist validator delegators';

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
      'notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius',
      {
        prefix: 'aura',
      }
    );
    const client = await SigningStargateClient.connectWithSigner(
      network.find((net) => net.chainId === config.chainId)?.RPC[0] ?? '',
      wallet,
      defaultSigningClientOptions
    );

    let result = await client.delegateTokens(
      'aura1cyyzpxplxdzkeea7kwsydadg87357qnaysj0zm',
      'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg',
      amount[0],
      defaultSendFee,
      memo
    );
    assertIsDeliverTxSuccess(result);

    const validator = await Validator.query().first();

    await this.crawlDelegatorsService?.handleJobCrawlValidatorDelegators({
      id: validator?.id ?? 1,
      address: validator?.operator_address ?? '',
      height: validator?.delegators_last_height ?? 0,
    });

    const delegators = await Delegator.query();

    expect(
      _.omit(
        delegators.find(
          (del) =>
            del.delegator_address ===
            'aura1cyyzpxplxdzkeea7kwsydadg87357qnaysj0zm'
        ),
        ['id']
      )
    ).toEqual({
      validator_id: validator?.id,
      delegator_address: 'aura1cyyzpxplxdzkeea7kwsydadg87357qnaysj0zm',
      amount: '2000000',
    });

    result = await client.undelegateTokens(
      'aura1cyyzpxplxdzkeea7kwsydadg87357qnaysj0zm',
      'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg',
      amount[0],
      defaultSendFee,
      memo
    );
    assertIsDeliverTxSuccess(result);

    await this.crawlDelegatorsService?.handleJobCrawlValidatorDelegators({
      id: validator?.id ?? 1,
      address: validator?.operator_address ?? '',
      height: validator?.delegators_last_height ?? 0,
    });

    const updateDelegators = await Delegator.query();

    expect(
      updateDelegators.find(
        (del) =>
          del.delegator_address ===
          'aura1cyyzpxplxdzkeea7kwsydadg87357qnaysj0zm'
      )
    ).toBeUndefined();
  }
}
