import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { Log } from '@cosmjs/stargate/build/logs';
import { Attribute, Event } from '@cosmjs/stargate/build/events';
import {
  Transaction,
  Event as EventModel,
  Block,
} from '../../../../src/models';
import { BULL_JOB_NAME } from '../../../../src/common';
import CrawlTxService from '../../../../src/services/crawl-tx/crawl_tx.service';
import knex from '../../../../src/common/utils/db_connection';
import tx_fixture from './tx.fixture.json' assert { type: 'json' };

@Describe('Test crawl transaction service')
export default class CrawlTransactionTest {
  broker = new ServiceBroker({ logger: false });

  crawlTxService?: CrawlTxService;

  @BeforeAll()
  async initSuite() {
    this.broker.start();
    this.crawlTxService = this.broker.createService(
      CrawlTxService
    ) as CrawlTxService;
    await Promise.all([
      this.crawlTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.CRAWL_TRANSACTION)
        .empty(),
      this.crawlTxService
        ?.getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_TRANSACTION)
        .empty(),
      knex.raw('TRUNCATE TABLE transaction RESTART IDENTITY CASCADE'),
      Block.query().insert(
        Block.fromJson({
          height: 423136,
          hash: 'data hash',
          time: '2023-04-17T03:44:41.000Z',
          proposer_address: 'proposer address',
          data: {},
        })
      ),
    ]);
  }

  @Test('Parse transaction and insert to DB')
  public async testHandleTransaction() {
    this.crawlTxService?.createJob(
      BULL_JOB_NAME.HANDLE_TRANSACTION,
      BULL_JOB_NAME.HANDLE_TRANSACTION,
      {
        listTx: { ...tx_fixture },
        height: 423136,
        timestamp: '2023-04-17T03:44:41.000Z',
      }
    );
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 2000));
    const tx = await Transaction.query().findOne(
      'hash',
      '5F38B0C3E9FAB4423C37FB6306AC06D983AF50013BC7BCFBD9F684D6BFB0AF23'
    );
    expect(tx).not.toBeUndefined();
    if (tx) {
      const logs = JSON.parse(tx_fixture.txs[0].tx_result.log);
      logs.forEach(async (log: Log) => {
        const msgIndex = log.msg_index ?? 0;
        log.events.forEach(async (event: Event) => {
          event.attributes.forEach(async (attribute: Attribute) => {
            const found = await EventModel.query()
              .select('value')
              .joinRelated('attributes')
              .where('event.tx_msg_index', msgIndex)
              .andWhere('event.tx_id', tx.id)
              .andWhere(
                'attributes.composite_key',
                `${event.type}.${attribute.key}`
              )
              .andWhere('value', attribute.value);

            expect(found).not.toBeUndefined();
            expect(found.length).not.toEqual(0);
          });
        });
      });
    }
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([
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
      knex.raw('TRUNCATE TABLE transaction RESTART IDENTITY CASCADE'),
      this.crawlTxService?._stop(),
    ]);
  }
}
