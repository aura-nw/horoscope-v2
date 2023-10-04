import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { Errors, ServiceBroker } from 'moleculer';
import Cw721AdminService from '../../../../src/services/api-gateways/cw721_admin.service';
import CW721ReindexingService from '../../../../src/services/cw721/cw721-reindexing.service';
import Cw721HandlerService from '../../../../src/services/cw721/cw721.service';

@Describe('Test cw721 admin api service')
export default class Cw721AdminTest {
  broker = new ServiceBroker({
    logger: false,
  });

  cw721Admin = this.broker.createService(
    Cw721AdminService
  ) as Cw721AdminService;

  cw721Reindex = this.broker.createService(
    CW721ReindexingService
  ) as CW721ReindexingService;

  cw721HandlerService = this.broker.createService(
    Cw721HandlerService
  ) as Cw721HandlerService;

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    await this.cw721HandlerService.getQueueManager().stopAll();
    await this.cw721Reindex.getQueueManager().stopAll();
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Invalid query format')
  public async testInvalidQueryFormat() {
    expect(
      this.broker.call('v1.cw721-admin.cw721Reindexing', {
        chainid: undefined,
        contractAddress: 'abc',
        type: 'all',
      })
    ).rejects.toBeInstanceOf(Errors.ValidationError);
    expect(
      this.broker.call('v1.cw721-admin.cw721Reindexing', {
        chainid: 'euphoria-2',
        contractAddress: undefined,
        type: 'all',
      })
    ).rejects.toBeInstanceOf(Errors.ValidationError);
    expect(
      this.broker.call('v1.cw721-admin.cw721Reindexing', {
        chainid: 'euphoria-2',
        contractAddress: 'abc',
        type: 'hihi',
      })
    ).rejects.toBeInstanceOf(Errors.ValidationError);
  }
}
