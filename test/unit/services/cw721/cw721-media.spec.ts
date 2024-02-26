import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME, Config } from '../../../../src/common';
import Cw721MediaService from '../../../../src/services/cw721/cw721-media.service';
import { BlockCheckpoint, Code } from '../../../../src/models';
import CW721Contract from '../../../../src/models/cw721_contract';
import knex from '../../../../src/common/utils/db_connection';

const { IPFS_GATEWAY } = Config;
@Describe('Test view count')
export default class TestCw721MediaService {
  broker = new ServiceBroker({ logger: false });

  cw721MediaService = this.broker.createService(
    Cw721MediaService
  ) as Cw721MediaService;

  mockInitContract = {
    ...CW721Contract.fromJson({
      contract_id: 1,
      symbol: 'symbol',
      minter: 'minter',
      name: '',
      track: true,
    }),
    tokens: [
      {
        token_id: 'token_id1',
        media_info: null,
        owner: 'owner1',
        cw721_contract_id: 1,
        last_updated_height: 1000,
      },
      {
        token_id: 'token_id2',
        media_info: null,
        owner: 'owner2',
        cw721_contract_id: 1,
        last_updated_height: 2000,
      },
    ],
    smart_contract: {
      code_id: 100,
      address: 'mock_contract_address_2',
      name: 'name',
      creator: 'phamphong_creator 2',
      instantiate_hash: 'abc',
      instantiate_height: 300000,
    },
  };

  mockInitContract_2 = {
    ...CW721Contract.fromJson({
      contract_id: 2,
      symbol: 'symbol',
      minter: 'minter',
    }),
    tokens: [
      {
        token_id: 'token_id1',
        media_info: null,
        owner: 'owner1',
        cw721_contract_id: 2,
        last_updated_height: 1000,
      },
      {
        token_id: 'token_id2',
        media_info: null,
        owner: 'owner2',
        cw721_contract_id: 2,
        last_updated_height: 2000,
      },
    ],
    smart_contract: {
      name: 'Base Contract 2',
      address: 'mock_contract_address',
      creator: 'phamphong_creator',
      code_id: 100,
      instantiate_hash: 'abc',
      instantiate_height: 300000,
    },
  };

  codeId = {
    ...Code.fromJson({
      creator: 'code_id_creator',
      code_id: 100,
      data_hash: 'code_id_data_hash',
      instantiate_permission: { permission: '', address: '', addresses: [] },
      store_hash: 'code_id_store_hash',
      store_height: 1000,
      type: 'CW721',
    }),
  };

  @BeforeAll()
  async initSuite() {
    this.cw721MediaService.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE smart_contract, block_checkpoint, cw721_token, cw721_contract, cw721_activity, code RESTART IDENTITY CASCADE'
    );
    await Code.query().insertGraph(this.codeId);
    await CW721Contract.query().insertGraph(this.mockInitContract);
    await CW721Contract.query().insertGraph(this.mockInitContract_2);
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

  @Test('test handle filter job')
  public async testJobHandleFilter() {
    const tokenJobs = jest
      .spyOn(this.cw721MediaService, 'createJob')
      .mockImplementation();
    const checkpoint = [
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.FILTER_TOKEN_MEDIA_UNPROCESS,
        height: 0,
      }),
    ];
    await BlockCheckpoint.query().insert(checkpoint);
    await this.cw721MediaService.jobHandlerFilter();
    expect(tokenJobs).toHaveBeenCalledTimes(
      this.mockInitContract.tokens.length +
        this.mockInitContract_2.tokens.length
    );
    const newCheckpoint = await BlockCheckpoint.query()
      .where('job_name', BULL_JOB_NAME.FILTER_TOKEN_MEDIA_UNPROCESS)
      .first();
    expect(newCheckpoint?.height).toEqual(
      this.mockInitContract.tokens.length +
        this.mockInitContract_2.tokens.length
    );
  }
}
