import { BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { Transaction, Block, TransactionMessage } from '../../../../src/models';
import { BULL_JOB_NAME, sleep } from '../../../../src/common';
import knex from '../../../../src/common/utils/db_connection';
import tx_fixture_authz from './tx_authz.fixture.json' assert { type: 'json' };
import HandleAuthzTxService from '../../../../src/services/crawl-tx/handle_authz_tx.service';
import CrawlTxService from '../../../../src/services/crawl-tx/crawl_tx.service';

@Describe('Test handle authz tx msg service')
export default class HandleAuthzTxMsgTest {
  broker = new ServiceBroker({ logger: false });

  crawlTxService?: CrawlTxService;

  handleAuthzTxServive?: HandleAuthzTxService;

  @BeforeAll()
  async initSuite() {
    this.broker.start();
    await this.handleAuthzTxServive
      ?.getQueueManager()
      .getQueue(BULL_JOB_NAME.HANDLE_AUTHZ_TX)
      .empty();
    this.handleAuthzTxServive = this.broker.createService(
      HandleAuthzTxService
    ) as HandleAuthzTxService;
    this.crawlTxService = this.broker.createService(
      CrawlTxService
    ) as CrawlTxService;
    Promise.all([
      this.crawlTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_TRANSACTION)
        .empty(),
      this.crawlTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_TRANSACTION)
        .empty(),
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE checkpoint RESTART IDENTITY CASCADE'),
    ]);
  }

  @Test('Parse transaction authz and insert to DB')
  public async testHandleTransactionAuthz() {
    await Block.query().insert(
      Block.fromJson({
        height: 452049,
        hash: 'data hash authz',
        time: '2023-04-17T03:44:41.000Z',
        proposer_address: 'proposer address',
        data: {},
      })
    );
    await this.crawlTxService?.jobHandlerTx({
      listTx: { ...tx_fixture_authz },
      height: 452049,
      timestamp: '2023-04-17T03:44:41.000Z',
    });
    // await sleep to wait handle authz tx message
    await sleep(6000);
    const tx = await Transaction.query().findOne(
      'hash',
      '14B177CFD3AC22F6AF1B46EF24C376B757B2379023E9EE075CB81A5E2FF18FAC'
    );
    expect(tx).not.toBeUndefined();
    if (tx) {
      const txMessages = await TransactionMessage.query()
        .joinRelated('transaction')
        .where('transaction.id', tx.id);
      expect(txMessages.length).toEqual(23);
    }
  }

  @BeforeAll()
  async tearDown() {
    await Promise.all([
      this.handleAuthzTxServive
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_AUTHZ_TX)
        .empty(),
      this.crawlTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_TRANSACTION)
        .empty(),
      this.crawlTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_TRANSACTION)
        .empty(),
    ]);
    await Promise.all([
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE checkpoint RESTART IDENTITY CASCADE'),
      this.handleAuthzTxServive?._stop(),
      this.broker.stop(),
    ]);
  }
}
