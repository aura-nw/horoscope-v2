import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { execSync } from 'child_process';
import {
  Account,
  AccountVesting,
  BlockCheckpoint,
  Validator,
} from '../../../../src/models';
import CrawlGenesisService from '../../../../src/services/crawl-genesis/crawl_genesis.service';
import { BULL_JOB_NAME } from '../../../../src/common';
import knex from '../../../../src/common/utils/db_connection';

@Describe('Test crawl_genesis service')
export default class CrawlGenesisTest {
  blockCheckpoint = BlockCheckpoint.fromJson({
    job_name: BULL_JOB_NAME.CRAWL_GENESIS,
    height: 1,
  });

  broker = new ServiceBroker({ logger: false });

  crawlGenesisService?: CrawlGenesisService;

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    await BlockCheckpoint.query().delete(true);
    await BlockCheckpoint.query().insert(this.blockCheckpoint);
    this.crawlGenesisService = this.broker.createService(
      CrawlGenesisService
    ) as CrawlGenesisService;
    await Promise.all([
      this.crawlGenesisService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_GENESIS)
        .empty(),
      this.crawlGenesisService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_GENESIS_ACCOUNT)
        .empty(),
      this.crawlGenesisService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_GENESIS_VALIDATOR)
        .empty(),
    ]);
    await Promise.all([
      Validator.query().delete(true),
      knex.raw('TRUNCATE TABLE account RESTART IDENTITY CASCADE'),
    ]);
    execSync('cp ./test/helper/genesis.txt .');
  }

  @AfterAll()
  async tearDown() {
    execSync('rm -rf genesis.txt');
    await Promise.all([
      BlockCheckpoint.query().delete(true),
      Validator.query().delete(true),
      knex.raw('TRUNCATE TABLE account RESTART IDENTITY CASCADE'),
    ]);
    await this.broker.stop();
  }

  @Test('Crawl accounts from genesis')
  public async testHandleCrawlGenesisAccounts() {
    await this.crawlGenesisService?.crawlGenesisAccounts({});

    const [accounts, accountVestings]: [Account[], AccountVesting[]] =
      await Promise.all([Account.query(), AccountVesting.query()]);

    expect(accounts.length).toEqual(8);
    expect(accountVestings.length).toEqual(4);

    expect(
      accounts.find(
        (acc) => acc.address === 'aura1rh28ys00u7ewps37sqq3aq6qtmmmrdckzuvlrr'
      )?.balances
    ).toEqual([
      {
        denom: 'uaura',
        amount: '100000000',
      },
    ]);
    expect(
      accounts.find(
        (acc) => acc.address === 'aura199zph4r44yvn8veraukw2c508z4pqrqxt3hyx4'
      )?.balances
    ).toEqual([
      {
        denom: 'uaura',
        amount: '5000000000000',
      },
    ]);
    expect(
      accounts.find(
        (acc) => acc.address === 'aura1xydnzs2s9pjh4cksc2ejv3t002d7pwedld2lp8'
      )?.balances
    ).toEqual([
      {
        denom: 'uaura',
        amount: '200000000',
      },
    ]);

    expect(
      accountVestings.find(
        (vesting) =>
          vesting.account_id ===
          accounts.find(
            (acc) =>
              acc.address === 'aura1trqfuz89vxe745lmn2yfedt7d4xnpcpvltc86e'
          )?.id
      )?.start_time
    ).toEqual(1651111200);
    expect(
      accountVestings.find(
        (vesting) =>
          vesting.account_id ===
          accounts.find(
            (acc) =>
              acc.address === 'aura1trqfuz89vxe745lmn2yfedt7d4xnpcpvltc86e'
          )?.id
      )?.end_time
    ).toEqual(1651154400);
    expect(
      accountVestings.find(
        (vesting) =>
          vesting.account_id ===
          accounts.find(
            (acc) =>
              acc.address === 'aura1xydnzs2s9pjh4cksc2ejv3t002d7pwedld2lp8'
          )?.id
      )?.start_time
    ).toEqual(1651111200);
    expect(
      accountVestings.find(
        (vesting) =>
          vesting.account_id ===
          accounts.find(
            (acc) =>
              acc.address === 'aura1xydnzs2s9pjh4cksc2ejv3t002d7pwedld2lp8'
          )?.id
      )?.end_time
    ).toEqual(1651154400);
  }

  @Test('Crawl validators from genesis')
  public async testHandleCrawlGenesisValidators() {
    await this.crawlGenesisService?.crawlGenesisValidators({});

    const validators: Validator[] = await Validator.query();

    expect(validators.length).toEqual(4);

    expect(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper199zph4r44yvn8veraukw2c508z4pqrqxsrxv7t'
      )?.account_address
    ).toEqual('aura199zph4r44yvn8veraukw2c508z4pqrqxt3hyx4');
    expect(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper1mvm4f62j96dw79gvc3zhyuef7wh453ca8rltx5'
      )?.account_address
    ).toEqual('aura1mvm4f62j96dw79gvc3zhyuef7wh453cau3wr72');
    expect(
      validators.find(
        (val) =>
          val.operator_address ===
          'auravaloper182lurpfs7xcle90hcjkmtnjf2efzx64ffen499'
      )?.account_address
    ).toEqual('aura182lurpfs7xcle90hcjkmtnjf2efzx64fjtzaam');
  }
}
