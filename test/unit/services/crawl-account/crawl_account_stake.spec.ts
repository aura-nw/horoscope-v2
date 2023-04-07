import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import {
  assertIsDeliverTxSuccess,
  MsgUndelegateEncodeObject,
  SigningStargateClient,
} from '@cosmjs/stargate';
import { coins, DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { ServiceBroker } from 'moleculer';
import { cosmos } from '@aura-nw/aurajs';
import {
  defaultSendFee,
  defaultSigningClientOptions,
} from '../../../helper/constant';
import {
  Account,
  AccountStake,
  TransactionEventAttribute,
  Validator,
} from '../../../../src/models';
import CrawlAccountStakeService from '../../../../src/services/crawl-account/crawl_account_stake.service';
import config from '../../../../config.json';
import network from '../../../../network.json';
import { BULL_JOB_NAME } from '../../../../src/common';

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
    await Promise.all([
      this.crawlAccountStakeService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_ACCOUNT_DELEGATIONS)
        .empty(),
      this.crawlAccountStakeService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_ACCOUNT_REDELEGATIONS)
        .empty(),
      this.crawlAccountStakeService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_ACCOUNT_UNBONDING)
        .empty(),
    ]);
    await Promise.all([
      AccountStake.query().delete(true),
      Validator.query().delete(true),
    ]);
    await Account.query().delete(true);
    await Account.query().insert(this.account);
    await Validator.query().insert(this.validators);
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([
      AccountStake.query().delete(true),
      Validator.query().delete(true),
    ]);
    await Account.query().delete(true);
    this.broker.stop();
  }

  @Test('Crawl account delegation success')
  public async testCrawlAccountDelegations() {
    const amount = coins(7890, 'uaura');
    const memo = 'test delegate';

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

    const result = await client.delegateTokens(
      'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg',
      amount[0],
      defaultSendFee,
      memo
    );
    assertIsDeliverTxSuccess(result);

    await this.crawlAccountStakeService?.handleJobAccountDelegations({
      listAddresses: ['aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk'],
    });

    const [accountStake, account, validator]: [
      AccountStake | undefined,
      Account | undefined,
      Validator | undefined
    ] = await Promise.all([
      AccountStake.query()
        .where('type', TransactionEventAttribute.EVENT_KEY.DELEGATE)
        .first(),
      Account.query()
        .where('address', 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk')
        .first(),
      Validator.query()
        .where(
          'operator_address',
          'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg'
        )
        .first(),
    ]);

    expect(accountStake?.account_id).toEqual(account?.id);
    expect(accountStake?.validator_src_id).toEqual(validator?.id);
    expect(accountStake?.validator_dst_id).toBeNull();
    expect(accountStake?.balance).toEqual('7890');
  }

  @Test('Crawl account unbond success')
  public async testCrawlAccountUnbonding() {
    const amount = coins(1000, 'uaura');
    const memo = 'test unbond';

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

    const unbondMsg: MsgUndelegateEncodeObject = {
      typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
      value: cosmos.staking.v1beta1.MsgUndelegate.fromPartial({
        delegatorAddress: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
        validatorAddress: 'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg',
        amount: amount[0],
      }),
    };

    const result = await client.signAndBroadcast(
      'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      [unbondMsg],
      defaultSendFee,
      memo
    );
    assertIsDeliverTxSuccess(result);

    await this.crawlAccountStakeService?.handleJobAccountUnbonding({
      listAddresses: ['aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk'],
    });

    const [accountStake, account, validator]: [
      AccountStake | undefined,
      Account | undefined,
      Validator | undefined
    ] = await Promise.all([
      AccountStake.query()
        .where('type', TransactionEventAttribute.EVENT_KEY.UNBOND)
        .first(),
      Account.query()
        .where('address', 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk')
        .first(),
      Validator.query()
        .where(
          'operator_address',
          'auravaloper1phaxpevm5wecex2jyaqty2a4v02qj7qmhyhvcg'
        )
        .first(),
    ]);

    expect(accountStake?.account_id).toEqual(account?.id);
    expect(accountStake?.validator_src_id).toEqual(validator?.id);
    expect(accountStake?.validator_dst_id).toBeNull();
    expect(accountStake?.balance).toEqual('1000');
    expect(accountStake?.creation_height).toEqual(result.height);
  }
}
