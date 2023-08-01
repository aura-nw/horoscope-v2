import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';

@Describe('Test cw20 reindexing service')
export default class TestCw20ReindexingService {
  broker = new ServiceBroker({ logger: false });

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE code, cw20_contract, block_checkpoint RESTART IDENTITY CASCADE'
    );
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Test HandleRangeBlockMissingContract')
  public async testHandleRangeBlockMissingContract() {
    console.log('abc');
  }

  @Test('Test ReindexingService function')
  public async testReindexingService() {
    console.log('abc');
  }

  @Test('Test track start at early time')
  public async testTrackStartAtEarlyTime() {
    console.log('abc');
  }
}
