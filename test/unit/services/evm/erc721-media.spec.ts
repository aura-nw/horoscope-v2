import { toBase64, toUtf8 } from '@cosmjs/encoding';
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
import { Erc721MediaHandler } from '../../../../src/services/evm/erc721_media_handler';

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
        token_id: '1014141',
        media_info: null,
        owner: 'owner1',
        last_updated_height: 1000,
      },
      {
        token_id: '4242147474741717414',
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
        token_id: '411741714142',
        media_info: null,
        owner: 'owner1',
        last_updated_height: 1000,
      },
      {
        token_id: '241414147174174',
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
    const parsedNativeUrl = Erc721MediaHandler.parseIPFSUri(nativeUrl);
    const parsedIpfsPath = Erc721MediaHandler.parseIPFSUri(ipfsPath);
    expect(parsedNativeUrl).toEqual(`${IPFS_GATEWAY}${path}`);
    expect(parsedIpfsPath).toEqual(`${IPFS_GATEWAY}${path}`);
  }

  @Test('Test parseFilenameFromIPFS function')
  public async testParseFilenameFromIPFS() {
    const host = 'ipfs';
    const path =
      'Qme33YMXArHQzDdgRxQuL6m7JDJNDKeAUyJXDQU3wnL7sf/1000_F_260918513_EtP8xFDBIj4SvHIuXPGdFIyEXyBCmTEq.jpg';
    const nativeUrl = `${host}://${path}`;
    const ipfsPath = `/${host}/${path}`;
    const httpPath = `http://ipfs.dev.aura.network:8080/ipfs/${path}`;
    const parsedNativeUrl = Erc721MediaHandler.parseFilenameFromIPFS(nativeUrl);
    const parsedIpfsPath = Erc721MediaHandler.parseFilenameFromIPFS(ipfsPath);
    const parsedHttpPath = Erc721MediaHandler.parseFilenameFromIPFS(httpPath);
    expect(parsedNativeUrl).toEqual(`ipfs/${path}`);
    expect(parsedIpfsPath).toEqual(`ipfs/${path}`);
    expect(parsedHttpPath).toEqual(`ipfs/${path}`);
    const subDomain =
      'bafybeie5gq4jxvzmsym6hjlwxej4rwdoxt7wadqvmmwbqi7r27fclha2va.ipfs.dweb.link';
    const httpSubDomain = `https://${subDomain}`;
    const parsedHttpSubDomain =
      Erc721MediaHandler.parseFilenameFromIPFS(httpSubDomain);
    expect(parsedHttpSubDomain).toEqual(subDomain);
    const file = '1.json';
    const httpFullSubDomain = `https://${subDomain}/${file}`;
    const parsedFullHttpSubDomain =
      Erc721MediaHandler.parseFilenameFromIPFS(httpFullSubDomain);
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

  @Test('test getMetadata')
  async testGetMetadata() {
    const imageUrl =
      'ipfs://QmPfi9CcTafv4C1sBZ5HxUs4PbvBi22nkjgqbypMhqaPLp/The_Immersion_Into_Aura_Odyssey.png';
    // Case token_uri: ipfs format
    const ipfsTokenUri =
      'ipfs://QmPf5LawLS1ZVqFTSs7JhFD6yteKQLXxYMEYoc1PcKkhVj/109';
    jest
      .spyOn(Erc721MediaHandler, 'downloadAttachment')
      .mockImplementationOnce(async () =>
        Buffer.from(`{
        "name": "Immersion 109",
        "description":
          "The Immersion: Into Aura Odyssey Collection is a collaboration between Micro3 and Aura Network, marking the debut of Aura EVM NFT.",
        "image": "${imageUrl}"
      }`)
      );
    const ipfsMetadata = await Erc721MediaHandler.getMetadata(ipfsTokenUri);
    expect(ipfsMetadata.image).toEqual(imageUrl);
    // Case token_uri: json
    const jsonTokenUri = `{"name": "Mahojin NFT #20", "description": "Mahojin NFT!", "image": "${imageUrl}"}`;
    const jsonMetadata = await Erc721MediaHandler.getMetadata(jsonTokenUri);
    expect(jsonMetadata.image).toEqual(imageUrl);
    // Case token_uri: base64
    const metadata = {
      name: 'Color Commemorative Launch NFT #999999',
      description:
        'Color Commemorative NFT to celebrate the launch of Story Testnet',
      external_url: 'https://colormp.com/',
      image: imageUrl,
      attributes: [{ trait_type: 'Serial Number', value: '999999' }],
    };
    const base64TokenUri = `data:application/json;base64,${toBase64(
      toUtf8(JSON.stringify(metadata))
    )}`;
    const base64Metadata = await Erc721MediaHandler.getMetadata(base64TokenUri);
    expect(base64Metadata.image).toEqual(imageUrl);
  }
}
