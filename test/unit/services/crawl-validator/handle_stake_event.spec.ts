import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common';
import {
  Account,
  Block,
  Transaction,
  // TransactionMessage,
  PowerEvent,
  Validator,
  BlockCheckpoint,
} from '../../../../src/models';
import HandleStakeEventService from '../../../../src/services/crawl-validator/handle_stake_event.service';
import knex from '../../../../src/common/utils/db_connection';

@Describe('Test handle_stake_event service')
export default class HandleStakeEventTest {
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
    messages: [
      {
        index: 0,
        type: '/cosmos.staking.v1beta1.MsgDelegate',
        sender: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
        content: {
          '@type': '/cosmos.staking.v1beta1.MsgDelegate',
          delegator_address: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
          validator_address:
            'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx',
          amount: {
            denom: 'utaura',
            amount: '1000000',
          },
        },
      },
      {
        index: 1,
        type: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
        sender: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
        content: {
          '@type': '/cosmos.staking.v1beta1.MsgBeginRedelegate',
          delegator_address: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
          validator_src_address:
            'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx',
          validator_dst_address:
            'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh',
          amount: {
            denom: 'utaura',
            amount: '1000000',
          },
        },
      },
    ],
    events: [
      {
        tx_msg_index: 0,
        type: 'delegate',
        attributes: [
          {
            key: 'validator',
            value: 'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx',
          },
          {
            key: 'amount',
            value: '1000000utaura',
          },
          {
            key: 'new_shares',
            value: '1000000.000000000000000000',
          },
        ],
      },
      {
        tx_msg_index: 0,
        type: 'message',
        attributes: [
          {
            key: 'action',
            value: '/cosmos.staking.v1beta1.MsgDelegate',
          },
          {
            key: 'module',
            value: 'staking',
          },
          {
            key: 'sender',
            value: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
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
          },
          {
            key: 'destination_validator',
            value: 'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh',
          },
          {
            key: 'amount',
            value: '1000000utaura',
          },
          {
            key: 'completion_time',
            value: '2023-04-05T02:45:20Z',
          },
        ],
      },
      {
        tx_msg_index: 1,
        type: 'message',
        attributes: [
          {
            key: 'action',
            value: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
          },
          {
            key: 'sender',
            value: 'aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx',
          },
          {
            key: 'module',
            value: 'staking',
          },
          {
            key: 'sender',
            value: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
          },
        ],
      },
    ],
  };

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

  handleStakeEventService?: HandleStakeEventService;

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    this.handleStakeEventService = this.broker.createService(
      HandleStakeEventService
    ) as HandleStakeEventService;
    await this.handleStakeEventService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.HANDLE_STAKE_EVENT)
      .empty();
    await Promise.all([
      BlockCheckpoint.query().delete(true),
      knex.raw('TRUNCATE TABLE validator RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE account RESTART IDENTITY CASCADE'),
    ]);
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
    await Account.query().insert(this.account);
    await Validator.query().insert(this.validators);
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([
      BlockCheckpoint.query().delete(true),
      knex.raw('TRUNCATE TABLE validator RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE account RESTART IDENTITY CASCADE'),
    ]);
    await this.broker.stop();
  }

  @Test('Handle stake event success and insert power_event to DB')
  public async testHandleStakeEvent() {
    // const txMessages: TransactionMessage[] = await TransactionMessage.query();

    await this.handleStakeEventService?.handleJob({
      // txIds: txMessages.map((tx) => tx.id),
    });

    const [powerEvents, validators]: [PowerEvent[], Validator[]] =
      await Promise.all([PowerEvent.query(), Validator.query()]);

    expect(
      powerEvents.find((event) => event.type === PowerEvent.TYPES.DELEGATE)
        ?.validator_dst_id
    ).toEqual(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx'
      )?.id
    );
    expect(
      powerEvents.find((event) => event.type === PowerEvent.TYPES.DELEGATE)
        ?.amount
    ).toEqual('1000000');
    expect(
      powerEvents.find((event) => event.type === PowerEvent.TYPES.DELEGATE)
        ?.height
    ).toEqual(3967530);

    expect(
      powerEvents.find((event) => event.type === PowerEvent.TYPES.REDELEGATE)
        ?.validator_src_id
    ).toEqual(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1d3n0v5f23sqzkhlcnewhksaj8l3x7jeyu938gx'
      )?.id
    );
    expect(
      powerEvents.find((event) => event.type === PowerEvent.TYPES.REDELEGATE)
        ?.validator_dst_id
    ).toEqual(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1edw4lwcz3esnlgzcw60ra8m38k3zygz2xtl2qh'
      )?.id
    );
    expect(
      powerEvents.find((event) => event.type === PowerEvent.TYPES.REDELEGATE)
        ?.amount
    ).toEqual('1000000');
    expect(
      powerEvents.find((event) => event.type === PowerEvent.TYPES.REDELEGATE)
        ?.height
    ).toEqual(3967530);
  }
}
