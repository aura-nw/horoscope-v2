import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import {
  Transaction,
  Block,
  TransactionMessage,
  BlockCheckpoint,
} from '../../../../src/models';
import { BULL_JOB_NAME } from '../../../../src/common';
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
    this.handleAuthzTxServive = this.broker.createService(
      HandleAuthzTxService
    ) as HandleAuthzTxService;
    this.crawlTxService = this.broker.createService(
      CrawlTxService
    ) as CrawlTxService;

    await Promise.all([
      knex.raw('TRUNCATE TABLE transaction_message RESTART IDENTITY CASCADE'),
      knex.raw(
        'TRUNCATE TABLE block, transaction, event RESTART IDENTITY CASCADE'
      ),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
    ]);

    await this.crawlTxService._start();
    await this.handleAuthzTxServive._start();

    this.crawlTxService?.getQueueManager().stopAll();
    this.handleAuthzTxServive?.getQueueManager().stopAll();
  }

  @Test('Parse transaction authz and insert to DB')
  public async testHandleTransactionAuthz() {
    await BlockCheckpoint.query().insert([
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
        height: 452000,
      }),
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_TRANSACTION,
        height: 452049,
      }),
    ]);

    await Block.query().insert(
      Block.fromJson({
        height: 452049,
        hash: 'data hash authz',
        time: '2023-04-17T03:44:41.000Z',
        proposer_address: 'proposer address',
        data: {},
      })
    );

    const listdecodedTx = await this.crawlTxService?.decodeListRawTx([
      {
        listTx: { ...tx_fixture_authz },
        height: 452049,
        timestamp: '2023-04-17T03:44:41.000Z',
      },
    ]);
    if (listdecodedTx)
      await knex.transaction(async (trx) => {
        await this.crawlTxService?.insertDecodedTxAndRelated(
          listdecodedTx,
          trx
        );
      });
    await this.handleAuthzTxServive?.handleJob();
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

  @AfterAll()
  async tearDown() {
    this.handleAuthzTxServive?.getQueueManager().stopAll();
    this.crawlTxService?.getQueueManager().stopAll();
    await Promise.all([
      knex.raw('TRUNCATE TABLE transaction_message RESTART IDENTITY CASCADE'),
      knex.raw(
        'TRUNCATE TABLE block, transaction, event RESTART IDENTITY CASCADE'
      ),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
      this.handleAuthzTxServive?._stop(),
      this.crawlTxService?._stop(),
      this.broker.stop(),
    ]);
  }
}
