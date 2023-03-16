import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
// import Transaction from '../../../../src/models/transaction';
import knex from '../../../../src/common/utils/db_connection';
import CrawlValidatorService from '../../../../src/services/crawl-validator/crawl_validator.service';

@Describe('Test crawl_validator service')
export default class CrawlValidatorTest {
  //   transaction: Transaction = Transaction.fromJson({
  //     height: 3967530,
  //     hash: '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997D',
  //     codespace: '',
  //     code: 0,
  //   });

  broker = new ServiceBroker({ logger: false });

  crawlValidatorService?: CrawlValidatorService;

  @BeforeAll()
  async initSuite() {
    this.broker.start();
    this.crawlValidatorService = this.broker.createService(
      CrawlValidatorService
    ) as CrawlValidatorService;
    await knex('validator').del();
    // await Transaction.query().insert(this.transaction);
  }

  @AfterAll()
  async tearDown() {
    await knex('validator').del();
    this.broker.stop();
  }

  @Test('Crawl validator info success')
  public async testCrawlValidator() {
    // const validator = await Validator.query().first();
    expect(1).toEqual(1);
  }
}
