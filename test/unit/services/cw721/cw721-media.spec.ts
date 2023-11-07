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

  @Test('Test parseFilename function')
  public async testParseFilename() {
    const host = 'ipfs';
    const path =
      'Qme33YMXArHQzDdgRxQuL6m7JDJNDKeAUyJXDQU3wnL7sf/1000_F_260918513_EtP8xFDBIj4SvHIuXPGdFIyEXyBCmTEq.jpg';
    const nativeUrl = `${host}://${path}`;
    const ipfsPath = `/${host}/${path}`;
    const httpPath = `http://ipfs.dev.aura.network:8080/ipfs/${path}`;
    const parsedNativeUrl = this.cw721MediaService.parseFilename(nativeUrl);
    const parsedIpfsPath = this.cw721MediaService.parseFilename(ipfsPath);
    const parsedHttpPath = this.cw721MediaService.parseFilename(httpPath);
    expect(parsedNativeUrl).toEqual(`ipfs/${path}`);
    expect(parsedIpfsPath).toEqual(`ipfs/${path}`);
    expect(parsedHttpPath).toEqual(`ipfs/${path}`);
    const httpWrongPath =
      'http://ipfs.dev.aura.network:8080/ipfs/Qme33YMXArHQzDdgRxQuL6m7JDJNDKeAUyJXDQU3wnL7s/1000_F_260918513_EtP8xFDBIj4SvHIuXPGdFIyEXyBCmTEq.jpg';
    expect(this.cw721MediaService.parseFilename(httpWrongPath)).toBeNull();
    const subDomain =
      'bafybeie5gq4jxvzmsym6hjlwxej4rwdoxt7wadqvmmwbqi7r27fclha2va.ipfs.dweb.link';
    const httpSubDomain = `https://${subDomain}`;
    const parsedHttpSubDomain =
      this.cw721MediaService.parseFilename(httpSubDomain);
    expect(parsedHttpSubDomain).toEqual(subDomain);
    const file = '1.json';
    const httpFullSubDomain = `https://${subDomain}/${file}`;
    const parsedFullHttpSubDomain =
      this.cw721MediaService.parseFilename(httpFullSubDomain);
    expect(parsedFullHttpSubDomain).toEqual(`${subDomain}/${file}`);
  }
}
