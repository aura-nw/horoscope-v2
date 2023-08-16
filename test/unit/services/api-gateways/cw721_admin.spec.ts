import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
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
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Invalid query format')
  public async testInvalidQueryFormat() {
    let err = null;
    try {
      await this.broker.call('v1.cw721-admin.cw721Reindexing', {
        chainid: undefined,
        contractAddress: 'abc',
        type: 'all',
      });
    } catch (e) {
      err = e;
    }
    expect(err).not.toBeNull();
    let err2 = null;
    try {
      await this.broker.call('v1.cw721-admin.cw721Reindexing', {
        chainid: 'euphoria-2',
        contractAddress: undefined,
        type: 'all',
      });
    } catch (e) {
      err2 = e;
    }
    expect(err2).not.toBeNull();
    let err3 = null;
    try {
      await this.broker.call('v1.cw721-admin.cw721Reindexing', {
        chainid: 'euphoria-2',
        contractAddress: 'abc',
        type: 'hihi',
      });
    } catch (e) {
      err3 = e;
    }
    expect(err3).not.toBeNull();
  }
}
