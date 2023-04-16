import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common';
import {
  Account,
  Block,
  Transaction,
  Validator,
  TransactionEventAttribute,
  TransactionEvent,
  AccountStake,
} from '../../../../src/models';
import CrawlAccountStakeService from '../../../../src/services/crawl-account/crawl_account_stake.service';

@Describe('Test crawl_account_stake service')
export default class CrawlAccountStakeTest {
  block = [
    Block.fromJson({
      height: 3967530,
      hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9F',
      time: '2023-01-12T01:53:57.216Z',
      proposer_address: 'auraomd;cvpio3j4eg',
      data: {},
    }),
    Block.fromJson({
      height: 3967531,
      hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9G',
      time: '2023-01-12T01:54:57.216Z',
      proposer_address: 'auraomd;cvpio3j4eg',
      data: {},
    }),
    Block.fromJson({
      height: 3967532,
      hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9H',
      time: '2023-01-12T01:55:57.216Z',
      proposer_address: 'auraomd;cvpio3j4eg',
      data: {},
    }),
    Block.fromJson({
      height: 3967533,
      hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9I',
      time: '2023-01-12T01:55:57.216Z',
      proposer_address: 'auraomd;cvpio3j4eg',
      data: {},
    }),
  ];

  txInsert = [
    {
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
          type: 'delegate',
          attributes: [
            {
              key: 'validator',
              value: 'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx',
              msg_index: 0,
            },
            {
              key: 'amount',
              value: '1000000uaura',
              msg_index: 0,
            },
          ],
        },
        {
          tx_msg_index: 0,
          type: 'message',
          attributes: [
            {
              key: 'sender',
              value: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
              msg_index: 0,
            },
          ],
        },
        {
          tx_msg_index: 1,
          type: 'redelegate',
          attributes: [
            {
              key: 'source_validator',
              value: 'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx',
              msg_index: 1,
            },
            {
              key: 'destination_validator',
              value: 'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh',
              msg_index: 1,
            },
            {
              key: 'amount',
              value: '200000uaura',
              msg_index: 1,
            },
            {
              key: 'completion_time',
              value: '2023-04-05T02:45:20Z',
              msg_index: 1,
            },
          ],
        },
        {
          tx_msg_index: 1,
          type: 'message',
          attributes: [
            {
              key: 'sender',
              value: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
              msg_index: 1,
            },
          ],
        },
        {
          tx_msg_index: 2,
          type: 'unbond',
          attributes: [
            {
              key: 'validator',
              value: 'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx',
              msg_index: 2,
            },
            {
              key: 'amount',
              value: '500000uaura',
              msg_index: 2,
            },
            {
              key: 'completion_time',
              value: '2023-04-05T02:45:20Z',
              msg_index: 2,
            },
          ],
        },
        {
          tx_msg_index: 2,
          type: 'message',
          attributes: [
            {
              key: 'sender',
              value: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
              msg_index: 2,
            },
          ],
        },
      ],
    },
    {
      ...Transaction.fromJson({
        height: 3967531,
        hash: '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997E',
        codespace: '',
        code: 0,
        gas_used: '123035',
        gas_wanted: '141106',
        gas_limit: '141106',
        fee: 353,
        timestamp: '2023-01-12T01:54:57.000Z',
        data: {},
      }),
      events: [
        {
          tx_msg_index: 0,
          type: 'delegate',
          attributes: [
            {
              key: 'validator',
              value: 'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx',
              msg_index: 0,
            },
            {
              key: 'amount',
              value: '1000000uaura',
              msg_index: 0,
            },
          ],
        },
        {
          tx_msg_index: 0,
          type: 'message',
          attributes: [
            {
              key: 'sender',
              value: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
              msg_index: 0,
            },
          ],
        },
      ],
    },
    {
      ...Transaction.fromJson({
        height: 3967532,
        hash: '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997F',
        codespace: '',
        code: 0,
        gas_used: '123035',
        gas_wanted: '141106',
        gas_limit: '141106',
        fee: 353,
        timestamp: '2023-01-12T01:55:57.000Z',
        data: {},
      }),
      events: [
        {
          tx_msg_index: 0,
          type: 'redelegate',
          attributes: [
            {
              key: 'source_validator',
              value: 'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx',
              msg_index: 0,
            },
            {
              key: 'destination_validator',
              value: 'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh',
              msg_index: 0,
            },
            {
              key: 'amount',
              value: '1300000uaura',
              msg_index: 0,
            },
            {
              key: 'completion_time',
              value: '2023-05-05T02:45:20Z',
              msg_index: 0,
            },
          ],
        },
        {
          tx_msg_index: 0,
          type: 'message',
          attributes: [
            {
              key: 'sender',
              value: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
              msg_index: 0,
            },
          ],
        },
      ],
    },
    {
      ...Transaction.fromJson({
        height: 3967533,
        hash: '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997G',
        codespace: '',
        code: 0,
        gas_used: '123035',
        gas_wanted: '141106',
        gas_limit: '141106',
        fee: 353,
        timestamp: '2023-01-12T01:55:57.000Z',
        data: {},
      }),
      events: [
        {
          tx_msg_index: 0,
          type: 'unbond',
          attributes: [
            {
              key: 'validator',
              value: 'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh',
              msg_index: 0,
            },
            {
              key: 'amount',
              value: '1500000uaura',
              msg_index: 0,
            },
            {
              key: 'completion_time',
              value: '2023-05-05T02:45:20Z',
              msg_index: 0,
            },
          ],
        },
        {
          tx_msg_index: 0,
          type: 'message',
          attributes: [
            {
              key: 'sender',
              value: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
              msg_index: 0,
            },
          ],
        },
      ],
    },
  ];

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
    await this.broker.start();
    this.crawlAccountStakeService = this.broker.createService(
      CrawlAccountStakeService
    ) as CrawlAccountStakeService;
    await this.crawlAccountStakeService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.CRAWL_ACCOUNT_STAKE)
      .empty();
    await Promise.all([
      TransactionEventAttribute.query().delete(true),
      AccountStake.query().delete(true),
    ]);
    await Promise.all([
      TransactionEvent.query().delete(true),
      Account.query().delete(true),
      Validator.query().delete(true),
    ]);
    await Transaction.query().delete(true);
    await Block.query().delete(true);
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
    await Account.query().insert(this.account);
    await Validator.query().insert(this.validators);
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([
      TransactionEventAttribute.query().delete(true),
      AccountStake.query().delete(true),
    ]);
    await Promise.all([
      TransactionEvent.query().delete(true),
      Account.query().delete(true),
      Validator.query().delete(true),
    ]);
    await Transaction.query().delete(true);
    await Block.query().delete(true);
    await this.broker.stop();
  }

  @Test('Crawl account stake success and insert new account_stake to DB')
  public async testCrawlAccountStake() {
    const txs: Transaction[] = await Transaction.query().where(
      'height',
      3967530
    );

    await this.crawlAccountStakeService?.handleJob({
      txIds: txs.map((tx) => tx.id),
    });

    const [accountStakes, validators]: [AccountStake[], Validator[]] =
      await Promise.all([AccountStake.query(), Validator.query()]);

    expect(
      accountStakes.find(
        (stake) =>
          stake.type === AccountStake.TYPES.DELEGATE &&
          stake.validator_src_id ===
            validators.find(
              (val) =>
                val.operator_address ===
                'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx'
            )?.id
      )?.balance
    ).toEqual('300000');
    expect(
      accountStakes.find(
        (stake) =>
          stake.type === AccountStake.TYPES.DELEGATE &&
          stake.validator_src_id ===
            validators.find(
              (val) =>
                val.operator_address ===
                'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh'
            )?.id
      )?.balance
    ).toEqual('200000');

    expect(
      accountStakes.find(
        (stake) => stake.type === AccountStake.TYPES.REDELEGATE
      )?.validator_src_id
    ).toEqual(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx'
      )?.id
    );
    expect(
      accountStakes.find(
        (stake) => stake.type === AccountStake.TYPES.REDELEGATE
      )?.validator_dst_id
    ).toEqual(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh'
      )?.id
    );
    expect(
      accountStakes.find(
        (stake) => stake.type === AccountStake.TYPES.REDELEGATE
      )?.balance
    ).toEqual('200000');
    expect(
      accountStakes.find(
        (stake) => stake.type === AccountStake.TYPES.REDELEGATE
      )?.end_time
    ).toEqual(new Date('2023-04-05T02:45:20Z'));

    expect(
      accountStakes.find((stake) => stake.type === AccountStake.TYPES.UNBOND)
        ?.validator_src_id
    ).toEqual(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx'
      )?.id
    );
    expect(
      accountStakes.find((stake) => stake.type === AccountStake.TYPES.UNBOND)
        ?.balance
    ).toEqual('500000');
    expect(
      accountStakes.find((stake) => stake.type === AccountStake.TYPES.UNBOND)
        ?.end_time
    ).toEqual(new Date('2023-04-05T02:45:20Z'));
  }

  @Test('Crawl account stake success and update delegation tx type delegate')
  public async testCrawlExistAccountStakeDelegate_caseDelegate() {
    const txs: Transaction[] = await Transaction.query().where(
      'height',
      3967531
    );

    await this.crawlAccountStakeService?.handleJob({
      txIds: txs.map((tx) => tx.id),
    });

    const [accountStakes, validators]: [AccountStake[], Validator[]] =
      await Promise.all([AccountStake.query(), Validator.query()]);

    expect(
      accountStakes.find(
        (stake) =>
          stake.type === AccountStake.TYPES.DELEGATE &&
          stake.validator_src_id ===
            validators.find(
              (val) =>
                val.operator_address ===
                'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx'
            )?.id
      )?.balance
    ).toEqual('1300000');
    expect(
      accountStakes.find(
        (stake) =>
          stake.type === AccountStake.TYPES.DELEGATE &&
          stake.validator_src_id ===
            validators.find(
              (val) =>
                val.operator_address ===
                'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh'
            )?.id
      )?.balance
    ).toEqual('200000');
  }

  @Test('Crawl account stake success and update delegation tx type redelegate')
  public async testCrawlExistAccountStakeDelegate_caseRedelegate() {
    const txs: Transaction[] = await Transaction.query().where(
      'height',
      3967532
    );

    await this.crawlAccountStakeService?.handleJob({
      txIds: txs.map((tx) => tx.id),
    });

    const [accountStakes, validators]: [AccountStake[], Validator[]] =
      await Promise.all([AccountStake.query(), Validator.query()]);

    expect(
      accountStakes.find(
        (stake) =>
          stake.type === AccountStake.TYPES.DELEGATE &&
          stake.validator_src_id ===
            validators.find(
              (val) =>
                val.operator_address ===
                'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx'
            )?.id
      )
    ).toBeUndefined();
    expect(
      accountStakes.find(
        (stake) =>
          stake.type === AccountStake.TYPES.DELEGATE &&
          stake.validator_src_id ===
            validators.find(
              (val) =>
                val.operator_address ===
                'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh'
            )?.id
      )?.balance
    ).toEqual('1500000');

    expect(
      accountStakes.find(
        (stake) =>
          stake.type === AccountStake.TYPES.REDELEGATE &&
          stake.end_time?.toString() ===
            new Date('2023-05-05T02:45:20Z').toString()
      )?.validator_src_id
    ).toEqual(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx'
      )?.id
    );
    expect(
      accountStakes.find(
        (stake) =>
          stake.type === AccountStake.TYPES.REDELEGATE &&
          stake.end_time?.toString() ===
            new Date('2023-05-05T02:45:20Z').toString()
      )?.validator_dst_id
    ).toEqual(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh'
      )?.id
    );
    expect(
      accountStakes.find(
        (stake) =>
          stake.type === AccountStake.TYPES.REDELEGATE &&
          stake.end_time?.toString() ===
            new Date('2023-05-05T02:45:20Z').toString()
      )?.balance
    ).toEqual('1300000');
  }

  @Test('Crawl account stake success and update delegation tx type unbond')
  public async testCrawlExistAccountStakeDelegate_caseUnbond() {
    const txs: Transaction[] = await Transaction.query().where(
      'height',
      3967533
    );

    await this.crawlAccountStakeService?.handleJob({
      txIds: txs.map((tx) => tx.id),
    });

    const [accountStakes, validators]: [AccountStake[], Validator[]] =
      await Promise.all([AccountStake.query(), Validator.query()]);

    expect(
      accountStakes.find(
        (stake) =>
          stake.type === AccountStake.TYPES.DELEGATE &&
          stake.validator_src_id ===
            validators.find(
              (val) =>
                val.operator_address ===
                'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh'
            )?.id
      )
    ).toBeUndefined();

    expect(
      accountStakes.find(
        (stake) =>
          stake.type === AccountStake.TYPES.UNBOND &&
          stake.end_time?.toString() ===
            new Date('2023-05-05T02:45:20Z').toString()
      )?.validator_src_id
    ).toEqual(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh'
      )?.id
    );
    expect(
      accountStakes.find(
        (stake) =>
          stake.type === AccountStake.TYPES.UNBOND &&
          stake.end_time?.toString() ===
            new Date('2023-05-05T02:45:20Z').toString()
      )?.balance
    ).toEqual('1500000');
  }
}
