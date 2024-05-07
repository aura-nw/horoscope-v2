import {
  AfterAll,
  AfterEach,
  BeforeAll,
  Describe,
  Test,
} from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { Config } from '../../../../src/common';
import knex from '../../../../src/common/utils/db_connection';
import {
  BlockCheckpoint,
  EVMSmartContract,
  Erc721Contract,
} from '../../../../src/models';
import { BULL_JOB_NAME } from '../../../../src/services/evm/constant';
import Erc721Service from '../../../../src/services/evm/erc721.service';
import * as Erc721MediaHanlder from '../../../../src/services/evm/erc721_media_handler';

const { IPFS_GATEWAY } = Config;
@Describe('Test view count')
export default class TestErc721MediaService {
  broker = new ServiceBroker({ logger: false });

  erc721Service = this.broker.createService(Erc721Service) as Erc721Service;

  evmSmartContract = EVMSmartContract.fromJson({
    id: 555,
    address: 'ghghdfgdsgre',
    creator: 'dfgdfbvxcvxgfds',
    created_height: 100,
    created_hash: 'cvxcvcxv',
    type: EVMSmartContract.TYPES.ERC721,
    code_hash: 'dfgdfghf',
  });

  evmSmartContract2 = EVMSmartContract.fromJson({
    id: 666,
    address: 'bcvbcvbcv',
    creator: 'dfgdfbvxcvxgfds',
    created_height: 100,
    created_hash: 'xdasfsf',
    type: EVMSmartContract.TYPES.ERC721,
    code_hash: 'xcsadf',
  });

  mockInitContract = {
    ...Erc721Contract.fromJson({
      symbol: 'symbol',
      name: '',
      track: true,
      address: '0xabcsss',
      evm_smart_contract_id: this.evmSmartContract.id,
    }),
    tokens: [
      {
        token_id: 'token_id1',
        media_info: null,
        owner: 'owner1',
        last_updated_height: 1000,
      },
      {
        token_id: 'token_id2',
        media_info: null,
        owner: 'owner2',
        last_updated_height: 2000,
      },
    ],
  };

  mockInitContract_2 = {
    ...Erc721Contract.fromJson({
      symbol: 'symbol',
      address: '0xabcssddds',
      evm_smart_contract_id: this.evmSmartContract2.id,
    }),
    tokens: [
      {
        token_id: 'token_id1',
        media_info: null,
        owner: 'owner1',
        last_updated_height: 1000,
      },
      {
        token_id: 'token_id2',
        media_info: null,
        owner: 'owner2',
        last_updated_height: 2000,
      },
    ],
  };

  @BeforeAll()
  async initSuite() {
    this.erc721Service.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE evm_smart_contract, block_checkpoint, erc721_token, erc721_contract, erc721_activity RESTART IDENTITY CASCADE'
    );
    await EVMSmartContract.query().insert([
      this.evmSmartContract,
      this.evmSmartContract2,
    ]);
    await Erc721Contract.query().insertGraph(this.mockInitContract);
    await Erc721Contract.query().insertGraph(this.mockInitContract_2);
  }

  @AfterEach()
  async afterEach() {
    jest.resetAllMocks();
    jest.restoreAllMocks();
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
    const parsedNativeUrl = Erc721MediaHanlder.parseIPFSUri(nativeUrl);
    const parsedIpfsPath = Erc721MediaHanlder.parseIPFSUri(ipfsPath);
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
    const parsedNativeUrl = Erc721MediaHanlder.parseFilename(nativeUrl);
    const parsedIpfsPath = Erc721MediaHanlder.parseFilename(ipfsPath);
    const parsedHttpPath = Erc721MediaHanlder.parseFilename(httpPath);
    expect(parsedNativeUrl).toEqual(`ipfs/${path}`);
    expect(parsedIpfsPath).toEqual(`ipfs/${path}`);
    expect(parsedHttpPath).toEqual(`ipfs/${path}`);
    const httpWrongPath =
      'http://ipfs.dev.aura.network:8080/ipfs/Qme33YMXArHQzDdgRxQuL6m7JDJNDKeAUyJXDQU3wnL7s/1000_F_260918513_EtP8xFDBIj4SvHIuXPGdFIyEXyBCmTEq.jpg';
    expect(Erc721MediaHanlder.parseFilename(httpWrongPath)).toBeNull();
    const subDomain =
      'bafybeie5gq4jxvzmsym6hjlwxej4rwdoxt7wadqvmmwbqi7r27fclha2va.ipfs.dweb.link';
    const httpSubDomain = `https://${subDomain}`;
    const parsedHttpSubDomain = Erc721MediaHanlder.parseFilename(httpSubDomain);
    expect(parsedHttpSubDomain).toEqual(subDomain);
    const file = '1.json';
    const httpFullSubDomain = `https://${subDomain}/${file}`;
    const parsedFullHttpSubDomain =
      Erc721MediaHanlder.parseFilename(httpFullSubDomain);
    expect(parsedFullHttpSubDomain).toEqual(`${subDomain}/${file}`);
  }

  @Test('test handle media')
  public async testJobHandleMedia() {
    const tokenJobs = jest
      .spyOn(this.erc721Service, 'createJob')
      .mockImplementation();
    const checkpoint = [
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_ERC721_MEDIA,
        height: 0,
      }),
    ];
    await BlockCheckpoint.query().insert(checkpoint);
    await this.erc721Service.handleErc721Media();
    expect(tokenJobs).toHaveBeenCalledTimes(
      this.mockInitContract.tokens.length +
        this.mockInitContract_2.tokens.length
    );
    const newCheckpoint = await BlockCheckpoint.query()
      .where('job_name', BULL_JOB_NAME.HANDLE_ERC721_MEDIA)
      .first();
    expect(newCheckpoint?.height).toEqual(
      this.mockInitContract.tokens.length +
        this.mockInitContract_2.tokens.length
    );
  }
}
