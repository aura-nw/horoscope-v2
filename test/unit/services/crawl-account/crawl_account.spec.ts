import {
  coins,
  DirectSecp256k1HdWallet,
  // GeneratedType,
} from '@cosmjs/proto-signing';
import {
  assertIsDeliverTxSuccess,
  SigningStargateClient,
} from '@cosmjs/stargate';
import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { cosmos } from '@aura-nw/aurajs';
import Long from 'long';
import { AccountType, BULL_JOB_NAME } from '../../../../src/common';
import {
  defaultSendFee,
  defaultSigningClientOptions,
} from '../../../helper/constant';
import {
  Account,
  AccountVesting,
  BlockCheckpoint,
} from '../../../../src/models';
import CrawlAccountService from '../../../../src/services/crawl-account/crawl_account.service';
import config from '../../../../config.json' assert { type: 'json' };
import network from '../../../../network.json' assert { type: 'json' };

@Describe('Test crawl_account service')
export default class CrawlAccountTest {
  blockCheckpoint: BlockCheckpoint = BlockCheckpoint.fromJson({
    job_name: BULL_JOB_NAME.CRAWL_GENESIS_ACCOUNT,
    height: 1,
  });

  accounts: Account[] = [
    // Base Account
    Account.fromJson({
      address: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      balances: [],
      spendable_balances: [],
      type: null,
      pubkey: {},
      account_number: 0,
      sequence: 0,
    }),
    // Vesting Accounts
    Account.fromJson({
      address: 'aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9',
      balances: [],
      spendable_balances: [],
      type: null,
      pubkey: {},
      account_number: 0,
      sequence: 0,
    }),
    // TODO: Currently cannot create MsgCreatePeriodicVestingAccount
    // Account.fromJson({
    //   address: 'aura1h6r78trkk2ewrry7s3lclrqu9a22ca3hpmyqfu',
    //   balances: [],
    //   spendable_balances: [],
    //   type: null,
    //   pubkey: {},
    //   account_number: 0,
    //   sequence: 0,
    // }),
    Account.fromJson({
      address: 'aura1fndgsk37dss8judrcaae0gamdqdr8t3rlmvtpm',
      balances: [],
      spendable_balances: [],
      type: null,
      pubkey: {},
      account_number: 0,
      sequence: 0,
    }),
  ];

  broker = new ServiceBroker({ logger: false });

  crawlAccountService?: CrawlAccountService;

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    await BlockCheckpoint.query().insert(this.blockCheckpoint);
    this.crawlAccountService = this.broker.createService(
      CrawlAccountService
    ) as CrawlAccountService;
    await Promise.all([
      this.crawlAccountService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_GENESIS_ACCOUNT)
        .empty(),
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
    ]);
    await AccountVesting.query().delete(true);
    await Account.query().delete(true);
    await Account.query().insert(this.accounts);
  }

  @AfterAll()
  async tearDown() {
    await AccountVesting.query().delete(true);
    await Account.query().delete(true);
    await this.broker.stop();
  }

  @Test('Crawl base account auth success')
  public async testCrawlBaseAccountAuth() {
    await this.crawlAccountService?.handleJobAccountAuth({
      addresses: ['aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk'],
    });

    const accounts: Account[] = await Account.query();

    expect(
      accounts.find(
        (acc) => acc.address === 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk'
      )?.type
    ).toEqual('/cosmos.auth.v1beta1.BaseAccount');
    expect(
      accounts.find(
        (acc) => acc.address === 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk'
      )?.account_number
    ).toEqual(3);
  }

  @Test('Crawl vesting account auth success')
  public async testCrawlVestingAccountAuth() {
    const amount = coins(2000000, 'uaura');
    const memo = 'test create vesting';
    const vestingEndTime = Math.floor(new Date().getTime() / 1000);

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
    // client.registry.register(
    //   '/cosmos.vesting.v1beta1.MsgCreatePeriodicVestingAccount',
    //   cosmos.vesting.v1beta1.MsgCreatePeriodicVestingAccount as GeneratedType
    // );

    const msgCreateContinuousVesting = {
      typeUrl: '/cosmos.vesting.v1beta1.MsgCreateVestingAccount',
      value: cosmos.vesting.v1beta1.MsgCreateVestingAccount.fromPartial({
        amount,
        fromAddress: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
        toAddress: 'aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9',
        delayed: false,
        endTime: Long.fromNumber(vestingEndTime),
      }),
    };
    // const msgCreatePeriodicVesting = {
    //   typeUrl: '/cosmos.vesting.v1beta1.MsgCreatePeriodicVestingAccount',
    //   value: cosmos.vesting.v1beta1.MsgCreatePeriodicVestingAccount.fromPartial(
    //     {
    //       fromAddress: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
    //       toAddress: 'aura1h6r78trkk2ewrry7s3lclrqu9a22ca3hpmyqfu',
    //       startTime: Long.fromNumber(vestingEndTime),
    //       vestingPeriods: [
    //         {
    //           length: '600',
    //           amount: [
    //             {
    //               denom: 'uaura',
    //               amount: '1000000',
    //             },
    //           ],
    //         },
    //         {
    //           length: '600',
    //           amount: [
    //             {
    //               denom: 'uaura',
    //               amount: '1000000',
    //             },
    //           ],
    //         },
    //       ],
    //     }
    //   ),
    // };
    const msgCreateDelayedVesting = {
      typeUrl: '/cosmos.vesting.v1beta1.MsgCreateVestingAccount',
      value: cosmos.vesting.v1beta1.MsgCreateVestingAccount.fromPartial({
        amount,
        fromAddress: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
        toAddress: 'aura1fndgsk37dss8judrcaae0gamdqdr8t3rlmvtpm',
        delayed: true,
        endTime: Long.fromNumber(vestingEndTime),
      }),
    };

    const result = await client.signAndBroadcast(
      'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      [
        msgCreateContinuousVesting,
        // msgCreatePeriodicVesting,
        msgCreateDelayedVesting,
      ],
      defaultSendFee,
      memo
    );
    assertIsDeliverTxSuccess(result);

    await this.crawlAccountService?.handleJobAccountAuth({
      listAddresses: [
        'aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9',
        // 'aura1h6r78trkk2ewrry7s3lclrqu9a22ca3hpmyqfu',
        'aura1fndgsk37dss8judrcaae0gamdqdr8t3rlmvtpm',
      ],
    });

    const [accounts, accountVestings]: [Account[], AccountVesting[]] =
      await Promise.all([Account.query(), AccountVesting.query()]);

    expect(
      accounts.find(
        (acc) => acc.address === 'aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9'
      )?.type
    ).toEqual('/cosmos.vesting.v1beta1.ContinuousVestingAccount');
    expect(
      accounts.find(
        (acc) => acc.address === 'aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9'
      )?.account_number
    ).toEqual(18);
    expect(
      accountVestings.find(
        (accVest) =>
          accVest.account_id ===
          accounts.find(
            (acc) =>
              acc.address === 'aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9'
          )?.id
      )?.end_time
    ).toEqual(vestingEndTime);

    // TODO: Currently cannot create MsgCreatePeriodicVestingAccount
    // expect(
    //   accounts.find(
    //     (acc) => acc.address === 'aura1h6r78trkk2ewrry7s3lclrqu9a22ca3hpmyqfu'
    //   )?.type
    // ).toEqual('/cosmos.vesting.v1beta1.PeriodicVestingAccount');
    // expect(
    //   accounts.find(
    //     (acc) => acc.address === 'aura1h6r78trkk2ewrry7s3lclrqu9a22ca3hpmyqfu'
    //   )?.pubkey.key
    // ).toEqual('AryNczu5JYt7y06GuffS257q/f/+TUinx1zDe9Jj1OHq');
    // expect(
    //   accounts.find(
    //     (acc) => acc.address === 'aura1h6r78trkk2ewrry7s3lclrqu9a22ca3hpmyqfu'
    //   )?.account_number
    // ).toEqual(1290);
    // expect(
    //   accountVestings.find(
    //     (accVest) =>
    //       accVest.account_id ===
    //       accounts.find(
    //         (acc) =>
    //           acc.address === 'aura1h6r78trkk2ewrry7s3lclrqu9a22ca3hpmyqfu'
    //       )?.id
    //   )?.start_time
    // ).toEqual(vestingEndTime);
    // expect(
    //   accountVestings.find(
    //     (accVest) =>
    //       accVest.account_id ===
    //       accounts.find(
    //         (acc) =>
    //           acc.address === 'aura1h6r78trkk2ewrry7s3lclrqu9a22ca3hpmyqfu'
    //       )?.id
    //   )?.end_time
    // ).toEqual(vestingEndTime + 1);

    expect(
      accounts.find(
        (acc) => acc.address === 'aura1fndgsk37dss8judrcaae0gamdqdr8t3rlmvtpm'
      )?.type
    ).toEqual('/cosmos.vesting.v1beta1.DelayedVestingAccount');
    expect(
      accounts.find(
        (acc) => acc.address === 'aura1fndgsk37dss8judrcaae0gamdqdr8t3rlmvtpm'
      )?.account_number
    ).toEqual(19);
    expect(
      accountVestings.find(
        (accVest) =>
          accVest.account_id ===
          accounts.find(
            (acc) =>
              acc.address === 'aura1fndgsk37dss8judrcaae0gamdqdr8t3rlmvtpm'
          )?.id
      )?.start_time
    ).toBeNull();
    expect(
      accountVestings.find(
        (accVest) =>
          accVest.account_id ===
          accounts.find(
            (acc) =>
              acc.address === 'aura1fndgsk37dss8judrcaae0gamdqdr8t3rlmvtpm'
          )?.id
      )?.end_time
    ).toEqual(vestingEndTime);
  }

  @Test('Crawl base account balances success')
  public async testCrawlBaseAccountBalances() {
    await this.crawlAccountService?.handleJobAccountBalances({
      addresses: ['aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk'],
    });

    const accounts: Account[] = await Account.query();

    expect(
      accounts.find(
        (acc) => acc.address === 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk'
      )?.balances.length
    ).toEqual(1);
  }

  @Test('Crawl base account spendable balances success')
  public async testCrawlBaseAccountSpendableBalances() {
    await this.crawlAccountService?.handleJobAccountSpendableBalances({
      addresses: ['aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk'],
    });

    const accounts: Account[] = await Account.query();

    expect(
      accounts.find(
        (acc) => acc.address === 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk'
      )?.spendable_balances.length
    ).toEqual(1);
  }

  @Test('Handle remaining and ended vesting accounts correctly')
  public async testHandleVestingAccounts() {
    const continuosEndTime = Math.floor(
      new Date().setSeconds(new Date().getSeconds() + 10) / 1000
    );
    const delayedEndTime = Math.floor(
      new Date().setSeconds(new Date().getSeconds() - 20) / 1000
    );
    const accounts: Account[] = await Account.query();
    await Promise.all([
      AccountVesting.query()
        .patch({
          end_time: continuosEndTime,
        })
        .where(
          'account_id',
          accounts.find((acc) => acc.type === AccountType.CONTINUOUS_VESTING)
            ?.id || 1
        ),
      AccountVesting.query()
        .patch({
          end_time: delayedEndTime,
        })
        .where(
          'account_id',
          accounts.find((acc) => acc.type === AccountType.DELAYED_VESTING)
            ?.id || 1
        ),
    ]);

    await this.crawlAccountService?.handleVestingAccounts({});

    const updatedAccounts: Account[] = await Account.query().whereIn('type', [
      AccountType.CONTINUOUS_VESTING,
      AccountType.DELAYED_VESTING,
    ]);

    expect(
      updatedAccounts.find((acc) => acc.type === AccountType.CONTINUOUS_VESTING)
        ?.spendable_balances.length
    ).toEqual(1);
    expect(
      updatedAccounts.find((acc) => acc.type === AccountType.DELAYED_VESTING)
        ?.spendable_balances.length
    ).toEqual(1);
  }
}
