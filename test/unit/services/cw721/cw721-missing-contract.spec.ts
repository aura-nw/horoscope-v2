import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { Errors, ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common';
import knex from '../../../../src/common/utils/db_connection';
import { BlockCheckpoint, Code } from '../../../../src/models';
import CW721Contract from '../../../../src/models/cw721_contract';
import CW721Token from '../../../../src/models/cw721_token';
import { SmartContractEvent } from '../../../../src/models/smart_contract_event';
import Cw721MissingContractService, {
  REINDEX_TYPE,
} from '../../../../src/services/cw721/cw721-reindexing.service';
import Cw721HandlerService, {
  CW721_ACTION,
} from '../../../../src/services/cw721/cw721.service';

@Describe('Test view count')
export default class TestCw721MissingContractService {
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
    contracts: [
      {
        name: 'Base Contract 2',
        address: 'mock_contract_address',
        creator: 'phamphong_creator',
        code_id: 100,
        instantiate_hash: 'abc',
        instantiate_height: 300000,
      },
      {
        code_id: 100,
        address: 'mock_contract_address_2',
        name: 'name',
        creator: 'phamphong_creator 2',
        instantiate_hash: 'abc',
        instantiate_height: 300000,
      },
    ],
  };

  cw721Contract = {
    ...CW721Contract.fromJson({
      contract_id: 1,
      symbol: '',
      name: 'jghdfgkjdfgjk',
      track: true,
    }),
    tokens: [
      {
        token_id: 'bhlvjdfkljkljg',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 122120,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'zzzvcxxb',
        owner: 'xctgxgvxcgxx',
        last_updated_height: 155,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'vbmnnmn',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 42424,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'vcgasdfsdg',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 121012,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'cbvcxbvcxgbdv',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 651651,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'dghdfghdfgfdgdf',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 2314,
        burned: false,
        cw721_contract_id: 1,
      },
    ],
  };

  broker = new ServiceBroker({ logger: false });

  cw721HandlerService = this.broker.createService(
    Cw721HandlerService
  ) as Cw721HandlerService;

  cw721MissingContractService = this.broker.createService(
    Cw721MissingContractService
  ) as Cw721MissingContractService;

  @BeforeAll()
  async initSuite() {
    await this.cw721HandlerService.getQueueManager().stopAll();
    await this.cw721MissingContractService.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE code, cw721_contract, block_checkpoint RESTART IDENTITY CASCADE'
    );
    await Code.query().insertGraph(this.codeId);
    await CW721Contract.query().insertGraph(this.cw721Contract);
    await BlockCheckpoint.query().insert(
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_CW721_TRANSACTION,
        height: 3967500,
      })
    );
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Test HandleRangeBlockMissingContract')
  public async testHandleRangeBlockMissingContract() {
    const missingHistories = [
      {
        contractAddress: this.codeId.contracts[0].address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.codeId.contracts[0].address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'transfer_nft',
          },
          {
            smart_contract_event_id: '100',
            key: 'recipient',
            value: 'phamphong_transfer',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: this.cw721Contract.tokens[0].token_id,
          },
        ],
        height: 122119,
        hash: '',
        event_id: '10',
      },
      {
        contractAddress: this.codeId.contracts[0].address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.codeId.contracts[0].address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'transfer_nft',
          },
          {
            smart_contract_event_id: '100',
            key: 'recipient',
            value: 'phamphong_transfer2',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: this.cw721Contract.tokens[1].token_id,
          },
        ],
        height: 200,
        hash: '',
        event_id: '100',
      },
      {
        contractAddress: this.codeId.contracts[0].address,
        sender: '',
        action: 'mint',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.codeId.contracts[0].address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'mint',
          },
          {
            smart_contract_event_id: '100',
            key: 'minter',
            value: 'pham_phong_re_mint_minter',
          },
          {
            smart_contract_event_id: '100',
            key: 'owner',
            value: 'phamphong_test_re_mint_owner',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: this.cw721Contract.tokens[4].token_id,
          },
        ],
        height: 651659,
        hash: '',
        event_id: 100,
      },
      {
        contractAddress: this.codeId.contracts[0].address,
        sender: '',
        action: 'burn',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.codeId.contracts[0].address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'burn',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'aura15f6wn3nymdnhnh5ddlqletuptjag09tryrtpq5',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: this.cw721Contract.tokens[2].token_id,
          },
        ],
        height: 42429,
        hash: '',
        event_id: 10,
      },
    ];
    await this.cw721HandlerService.handleCw721MsgExec(
      missingHistories
        .map((execEvent) => SmartContractEvent.fromJson({ ...execEvent }))
        .filter((history) => history.action !== CW721_ACTION.MINT)
    );
    const tokens = await CW721Token.query()
      .where('cw721_contract_id', 1)
      .orderBy('id');
    expect(tokens[0].owner).toEqual(this.cw721Contract.tokens[0].owner);
    expect(tokens[1].owner).toEqual(missingHistories[1].attributes[2].value);
    expect(tokens[2].burned).toEqual(true);
    expect(tokens[4].burned).toEqual(false);
  }

  @Test('Test ReindexingService function')
  public async testReindexingService() {
    const mockContractInfo = {
      address: this.codeId.contracts[0].address,
      name: 'dgjkfjgdkg',
      symbol: 'NNNJNJ',
      minter: 'hfgjksghkjsf',
    };
    const mockTokensOwner = [
      {
        owner: 'bhfgdgjdfhgjkd',
        token_id: 'token hjdfhd',
        last_updated_height: 100,
      },
      {
        owner: 'bnfgchdgd',
        token_id: 'tokehbfg',
        last_updated_height: 200,
      },
      {
        owner: 'gvxvbxcvxc',
        token_id: 'thjkhdsjk',
        last_updated_height: 300,
      },
      {
        owner: 'bcvbcgbg',
        token_id: 'jkljlk',
        last_updated_height: 400,
      },
    ];
    this.cw721HandlerService.crawlMissingContractHistory = jest.fn(() =>
      Promise.resolve()
    );
    this.cw721HandlerService.handleRangeBlockMissingContract = jest.fn(() =>
      Promise.resolve()
    );
    CW721Contract.getContractsInfo = jest.fn(() =>
      Promise.resolve([mockContractInfo])
    );
    CW721Contract.getAllTokensOwner = jest.fn(() =>
      Promise.resolve(mockTokensOwner)
    );
    await this.cw721MissingContractService.jobHandler({
      contractAddress: this.codeId.contracts[0].address,
      smartContractId: 1,
      type: REINDEX_TYPE.ALL,
    });
    const cw721Contract = await CW721Contract.query()
      .withGraphJoined('smart_contract')
      .where('smart_contract.address', this.codeId.contracts[0].address)
      .first()
      .throwIfNotFound();
    expect(cw721Contract.name).toEqual(mockContractInfo.name);
    expect(cw721Contract.minter).toEqual(mockContractInfo.minter);
    expect(cw721Contract.symbol).toEqual(mockContractInfo.symbol);
    const cw721Tokens = await CW721Token.query()
      .withGraphJoined('contract')
      .where('contract.id', cw721Contract.id);
    expect(
      cw721Tokens.map((token) => ({
        owner: token.owner,
        token_id: token.token_id,
        last_updated_height: token.last_updated_height,
      }))
    ).toEqual(mockTokensOwner);
  }

  @Test('Test track start at early time')
  public async testTrackStartAtEarlyTime() {
    const cw721Contract1 = {
      ...CW721Contract.fromJson({
        contract_id: 2,
        symbol: 'JJJ',
        name: 'xc xcvvxc',
        track: true,
      }),
      tokens: [
        {
          token_id: 'bhlvjdfkljkljg',
          owner: 'ghgfhdgdsfgsdgfsd',
          last_updated_height: 1000000,
          burned: false,
        },
      ],
    };
    await CW721Contract.query().insertGraph(cw721Contract1);
    const missingHistories = [
      {
        contractAddress: this.codeId.contracts[1].address,
        sender: '',
        action: 'mint',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.codeId.contracts[1].address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'mint',
          },
          {
            smart_contract_event_id: '100',
            key: 'minter',
            value: 'pham_phong_re_mint_minter',
          },
          {
            smart_contract_event_id: '100',
            key: 'owner',
            value: 'A',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: cw721Contract1.tokens[0].token_id,
          },
        ],
        height: 100,
        hash: '',
        event_id: 100,
      },
      {
        contractAddress: this.codeId.contracts[1].address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.codeId.contracts[1].address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'transfer_nft',
          },
          {
            smart_contract_event_id: '100',
            key: 'recipient',
            value: 'B',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: cw721Contract1.tokens[0].token_id,
          },
        ],
        height: 200,
        hash: '',
        event_id: '10',
      },
      {
        contractAddress: this.codeId.contracts[1].address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.codeId.contracts[1].address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'transfer_nft',
          },
          {
            smart_contract_event_id: '100',
            key: 'recipient',
            value: 'C',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: cw721Contract1.tokens[0].token_id,
          },
        ],
        height: 300,
        hash: '',
        event_id: '100',
      },
      {
        contractAddress: this.codeId.contracts[1].address,
        sender: '',
        action: 'burn',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.codeId.contracts[1].address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'burn',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'aura15f6wn3nymdnhnh5ddlqletuptjag09tryrtpq5',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: cw721Contract1.tokens[0].token_id,
          },
        ],
        height: 400,
        hash: '',
        event_id: 10,
      },
    ];
    await this.cw721HandlerService.handleCw721MsgExec(
      missingHistories.map((execEvent) =>
        SmartContractEvent.fromJson({ ...execEvent })
      )
    );
    const tokens = await CW721Token.query()
      .where('cw721_contract_id', 3)
      .orderBy('id');
    expect(tokens[0].owner).toEqual(missingHistories[2].attributes[2].value);
    expect(tokens[0].last_updated_height).toEqual(missingHistories[3].height);
    expect(tokens[0].burned).toEqual(true);
  }

  @Test('test action params')
  public async testActionParams() {
    expect(
      this.broker.call('v1.Cw721ReindexingService.reindexing', {
        contractAddresses: undefined,
        type: 'all',
      })
    ).rejects.toBeInstanceOf(Errors.ValidationError);
    expect(
      this.broker.call('v1.Cw721ReindexingService.reindexing', {
        contractAddresses: this.codeId.contracts[1].address,
        type: 'heell',
      })
    ).rejects.toBeInstanceOf(Errors.ValidationError);
    expect(
      this.broker.call('v1.Cw721ReindexingService.reindexing', {
        contractAddresses: [this.codeId.contracts[1].address],
        type: 'heell',
      })
    ).toBeDefined();
    expect(
      this.broker.call('v1.Cw721ReindexingService.reindexing', {
        contractAddresses: [this.codeId.contracts[1].address],
        type: REINDEX_TYPE.ALL,
      })
    ).toBeDefined();
    expect(
      this.broker.call('v1.Cw721ReindexingService.reindexing', {
        contractAddresses: [this.codeId.contracts[1].address],
        type: REINDEX_TYPE.HISTORY,
      })
    ).toBeDefined();
  }
}
