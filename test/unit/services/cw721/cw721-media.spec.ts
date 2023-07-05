import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { Config } from '../../../../src/common';
import Cw721MediaService from '../../../../src/services/cw721/cw721-media.service';

const { IPFS_GATEWAY } = Config;
@Describe('Test view count')
export default class TestCw721MediaService {
  broker = new ServiceBroker({ logger: false });

  cw721MediaService = this.broker.createService(
    Cw721MediaService
  ) as Cw721MediaService;

  @BeforeAll()
  async initSuite() {
    this.cw721MediaService.getQueueManager().stopAll();
    await this.broker.start();
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Test parseIPFSUri function')
  public async testParseIPFSUri() {
    const host = 'ipfs';
    const path =
      'Qme33YMXArHQzDdgRxQuL6m7JDJNDKeAUyJXDQU3wnL7sf/1000_F_260918513_EtP8xFDBIj4SvHIuXPGdFIyEXyBCmTEq.jpg';
    const nativeUrl = `${host}://${path}`;
    const ipfsPath = `/${host}/${path}`;
    const parsedNativeUrl = this.cw721MediaService.parseIPFSUri(nativeUrl);
    const parsedIpfsPath = this.cw721MediaService.parseIPFSUri(ipfsPath);
    expect(parsedNativeUrl).toEqual(`${IPFS_GATEWAY}${path}`);
    expect(parsedIpfsPath).toEqual(`${IPFS_GATEWAY}${path}`);
  }
}
