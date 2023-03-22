import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
// import AccountVesting from '../../../../src/models/account_vesting';
import knex from '../../../../src/common/utils/db_connection';
import { Account } from '../../../../src/models/account';
import CrawlAccountService from '../../../../src/services/crawl-account/crawl_account.service';

@Describe('Test crawl_account service')
export default class CrawlAccountTest {
  accounts: Account[] = [
    Account.fromJson({
      address: 'aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa',
      balances: [],
      spendable_balances: [],
      type: null,
      pubkey: {},
      account_number: 0,
      sequence: 0,
    }),
    Account.fromJson({
      address: 'aura1pzxc372f574uw989ds9s2acq5tlftexzql707v',
      balances: [],
      spendable_balances: [],
      type: null,
      pubkey: {},
      account_number: 0,
      sequence: 0,
    }),
    Account.fromJson({
      address: 'aura1h9gmwepxzm2nzl4exalny762xjzvad02zxwejc',
      balances: [],
      spendable_balances: [],
      type: null,
      pubkey: {},
      account_number: 0,
      sequence: 0,
    }),
    Account.fromJson({
      address: 'aura16tdzea2u2tkg7c5qr6m509de2j936spjhp5qc6',
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
    this.broker.start();
    this.crawlAccountService = this.broker.createService(
      CrawlAccountService
    ) as CrawlAccountService;
    await Promise.all([knex('account').del(), knex('account_vesting').del()]);
    await Account.query().insert(this.accounts);
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([knex('account').del(), knex('account_vesting').del()]);
    this.broker.stop();
  }

  @Test('Crawl base account auth success')
  public async testCrawlBaseAccountAuth() {
    await this.crawlAccountService?.handleJobAccountAuth({
      listAddresses: ['aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa'],
    });

    const accounts: Account[] = await Account.query();

    expect(
      accounts.find(
        (acc) => acc.address === 'aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa'
      )?.type
    ).toEqual('/cosmos.auth.v1beta1.BaseAccount');
    expect(
      accounts.find(
        (acc) => acc.address === 'aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa'
      )?.pubkey.key
    ).toEqual('A4veR43Br9oaixYMZXYaPfnUaVmdXAaBqGqb7Ujgqep2');
    expect(
      accounts.find(
        (acc) => acc.address === 'aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa'
      )?.account_number
    ).toEqual(10);
  }

  //   @Test('Crawl vesting account auth success')
  //   public async testCrawlVestingAccountAuth() {
  //     await this.crawlAccountService?.handleJobAccountAuth({
  //       listAddresses: [
  //         'aura1pzxc372f574uw989ds9s2acq5tlftexzql707v',
  //         'aura1h9gmwepxzm2nzl4exalny762xjzvad02zxwejc',
  //         'aura16tdzea2u2tkg7c5qr6m509de2j936spjhp5qc6',
  //       ],
  //     });

  //     const [accounts, accountVestings]: [Account[], AccountVesting[]] =
  //       await Promise.all([Account.query(), AccountVesting.query()]);

  //     expect(
  //       accounts.find(
  //         (acc) => acc.address === 'aura1pzxc372f574uw989ds9s2acq5tlftexzql707v'
  //       )?.type
  //     ).toEqual('/cosmos.vesting.v1beta1.ContinuousVestingAccount');
  //     expect(
  //       accounts.find(
  //         (acc) => acc.address === 'aura1pzxc372f574uw989ds9s2acq5tlftexzql707v'
  //       )?.account_number
  //     ).toEqual(227);
  //     expect(
  //       accountVestings.find(
  //         (accVest) =>
  //           accVest.account_id ===
  //           accounts.find(
  //             (acc) =>
  //               acc.address === 'aura1pzxc372f574uw989ds9s2acq5tlftexzql707v'
  //           )?.id
  //       )?.start_time
  //     ).toEqual(1660098504);
  //     expect(
  //       accountVestings.find(
  //         (accVest) =>
  //           accVest.account_id ===
  //           accounts.find(
  //             (acc) =>
  //               acc.address === 'aura1pzxc372f574uw989ds9s2acq5tlftexzql707v'
  //           )?.id
  //       )?.end_time
  //     ).toEqual(1641920400);

  //     expect(
  //       accounts.find(
  //         (acc) => acc.address === 'aura1h9gmwepxzm2nzl4exalny762xjzvad02zxwejc'
  //       )?.type
  //     ).toEqual('/cosmos.vesting.v1beta1.PeriodicVestingAccount');
  //     expect(
  //       accounts.find(
  //         (acc) => acc.address === 'aura1h9gmwepxzm2nzl4exalny762xjzvad02zxwejc'
  //       )?.pubkey.key
  //     ).toEqual('AryNczu5JYt7y06GuffS257q/f/+TUinx1zDe9Jj1OHq');
  //     expect(
  //       accounts.find(
  //         (acc) => acc.address === 'aura1h9gmwepxzm2nzl4exalny762xjzvad02zxwejc'
  //       )?.account_number
  //     ).toEqual(227);
  //     expect(
  //       accountVestings.find(
  //         (accVest) =>
  //           accVest.account_id ===
  //           accounts.find(
  //             (acc) =>
  //               acc.address === 'aura1h9gmwepxzm2nzl4exalny762xjzvad02zxwejc'
  //           )?.id
  //       )?.start_time
  //     ).toEqual(1667548800);
  //     expect(
  //       accountVestings.find(
  //         (accVest) =>
  //           accVest.account_id ===
  //           accounts.find(
  //             (acc) =>
  //               acc.address === 'aura1h9gmwepxzm2nzl4exalny762xjzvad02zxwejc'
  //           )?.id
  //       )?.end_time
  //     ).toEqual(1668148800);

  //     expect(
  //       accounts.find(
  //         (acc) => acc.address === 'aura16tdzea2u2tkg7c5qr6m509de2j936spjhp5qc6'
  //       )?.type
  //     ).toEqual('/cosmos.vesting.v1beta1.DelayedVestingAccount');
  //     expect(
  //       accounts.find(
  //         (acc) => acc.address === 'aura16tdzea2u2tkg7c5qr6m509de2j936spjhp5qc6'
  //       )?.account_number
  //     ).toEqual(633);
  //     expect(
  //       accountVestings.find(
  //         (accVest) =>
  //           accVest.account_id ===
  //           accounts.find(
  //             (acc) =>
  //               acc.address === 'aura16tdzea2u2tkg7c5qr6m509de2j936spjhp5qc6'
  //           )?.id
  //       )?.start_time
  //     ).toBeNull();
  //     expect(
  //       accountVestings.find(
  //         (accVest) =>
  //           accVest.account_id ===
  //           accounts.find(
  //             (acc) =>
  //               acc.address === 'aura16tdzea2u2tkg7c5qr6m509de2j936spjhp5qc6'
  //           )?.id
  //       )?.end_time
  //     ).toEqual(1662447600);
  //   }
}
