import {
  AfterAll,
  AfterEach,
  BeforeAll,
  Describe,
  Test,
} from '@jest-decorated/core';
import { Errors, ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME, SERVICE } from '../../../../src/common';
import knex from '../../../../src/common/utils/db_connection';
import { BlockCheckpoint, Code, EventAttribute } from '../../../../src/models';
import CW721Contract from '../../../../src/models/cw721_contract';
import CW721Token from '../../../../src/models/cw721_token';
import CW721Activity from '../../../../src/models/cw721_tx';
import { SmartContractEvent } from '../../../../src/models/smart_contract_event';
import Cw721MissingContractService, {
  REINDEX_TYPE,
} from '../../../../src/services/cw721/cw721-reindexing.service';
import Cw721HandlerService from '../../../../src/services/cw721/cw721.service';
import { getAttributeFrom } from '../../../../src/common/utils/smart_contract';
import { CW721_ACTION } from '../../../../src/services/cw721/cw721_handler';

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
        last_updated_height: 1,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'zzzvcxxb',
        owner: 'xctgxgvxcgxx',
        last_updated_height: 1,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'vbmnnmn',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 1,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'vcgasdfsdg',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 1,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'cbvcxbvcxgbdv',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 1,
        burned: false,
        cw721_contract_id: 1,
      },
      {
        token_id: 'dghdfghdfgfdgdf',
        owner: 'ghgfhdgdsfgsdgfsd',
        last_updated_height: 1,
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
    await this.broker.start();
    this.cw721HandlerService.getQueueManager().stopAll();
    this.cw721MissingContractService.getQueueManager().stopAll();
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
    this.cw721HandlerService.getQueueManager().stopAll();
    this.cw721MissingContractService.getQueueManager().stopAll();
  }

  @AfterEach()
  async afterEach() {
    jest.resetAllMocks();
  }

  @Test('Test HandleRangeBlockMissingContract')
  public async testHandleRangeBlockMissingContract() {
    const msgs = [
      SmartContractEvent.fromJson({
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
            value: 'aura15f6wn3nymdnhnh5ddlqletuptjag09tryrtpq5',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: this.cw721Contract.tokens[0].token_id,
          },
        ],
        height: 100,
        hash: '',
        event_id: '10',
      }),
      SmartContractEvent.fromJson({
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
            value: 'aura15f6wn3nymdnhnh5ddlqletuptjag09tryrtpq5',
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
      }),
      SmartContractEvent.fromJson({
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
            value: this.cw721Contract.tokens[2].token_id,
          },
        ],
        height: 300,
        hash: '',
        event_id: 100,
      }),
      SmartContractEvent.fromJson({
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
            value: this.cw721Contract.tokens[3].token_id,
          },
        ],
        height: 400,
        hash: '',
        event_id: 10,
      }),
    ];
    jest.spyOn(CW721Activity, 'getCw721ContractEvents').mockResolvedValue(msgs);
    await this.broker.call(
      SERVICE.V1.Cw721.HandleRangeBlockMissingContract.path,
      {
        smartContractId: 1,
        startBlock: 1,
        endBlock: 2,
      }
    );
    const tokens = await CW721Token.query()
      .where('cw721_contract_id', 1)
      .orderBy('id');
    expect(tokens[0].owner).toEqual(
      getAttributeFrom(
        msgs[0].attributes,
        EventAttribute.ATTRIBUTE_KEY.RECIPIENT
      )
    );
    expect(tokens[1].owner).toEqual(msgs[1].attributes[2].value);
    expect(tokens[3].burned).toEqual(true);
    expect(tokens[2].burned).toEqual(false);
    const cw721Activities = await CW721Activity.query().orderBy('id');
    cw721Activities.forEach((e, index) => {
      const recepient = getAttributeFrom(
        msgs[index].attributes,
        EventAttribute.ATTRIBUTE_KEY.RECIPIENT
      )
        ? getAttributeFrom(
            msgs[index].attributes,
            EventAttribute.ATTRIBUTE_KEY.RECIPIENT
          )
        : getAttributeFrom(
            msgs[index].attributes,
            EventAttribute.ATTRIBUTE_KEY.OWNER
          );
      this.testActivity(e, {
        sender: getAttributeFrom(
          msgs[index].attributes,
          EventAttribute.ATTRIBUTE_KEY.SENDER
        )
          ? getAttributeFrom(
              msgs[index].attributes,
              EventAttribute.ATTRIBUTE_KEY.SENDER
            )
          : getAttributeFrom(
              msgs[index].attributes,
              EventAttribute.ATTRIBUTE_KEY.MINTER
            ),
        from:
          msgs[index].action === CW721_ACTION.MINT
            ? null
            : this.cw721Contract.tokens[index].owner,
        to: msgs[index].action !== CW721_ACTION.BURN ? recepient : null,
        height: msgs[index].height,
        tx_hash: msgs[index].hash,
        action: msgs[index].action,
        cw721_contract_id: this.cw721Contract.tokens[index].cw721_contract_id,
        token_id: this.cw721Contract.tokens[index].token_id,
        cw721_token_id: tokens[index].id,
      });
    });
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
    jest
      .spyOn(this.cw721MissingContractService.broker, 'call')
      .mockImplementation();
    jest
      .spyOn(this.cw721MissingContractService, 'createJob')
      .mockImplementation();
    jest
      .spyOn(CW721Contract, 'getContractsInfo')
      .mockResolvedValue([mockContractInfo]);
    jest
      .spyOn(CW721Contract, 'getAllTokensOwner')
      .mockResolvedValue(mockTokensOwner);
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
          token_id: 'hihihahs',
          owner: 'ghgfhdgdsfgsdgfsd',
          last_updated_height: 10000,
          burned: false,
        },
      ],
    };
    await CW721Contract.query().insertGraph(cw721Contract1);
    const msgs = [
      SmartContractEvent.fromJson({
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
      }),
      SmartContractEvent.fromJson({
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
      }),
      SmartContractEvent.fromJson({
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
      }),
      SmartContractEvent.fromJson({
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
      }),
    ];
    jest.spyOn(CW721Activity, 'getCw721ContractEvents').mockResolvedValue(msgs);
    await this.broker.call(
      SERVICE.V1.Cw721.HandleRangeBlockMissingContract.path,
      {
        smartContractId: 1,
        startBlock: 1,
        endBlock: 2,
      }
    );
    const tokens = await CW721Token.query()
      .where('token_id', cw721Contract1.tokens[0].token_id)
      .orderBy('id');
    expect(tokens[0].owner).toEqual(tokens[0].owner);
    expect(tokens[0].last_updated_height).toEqual(
      tokens[0].last_updated_height
    );
    expect(tokens[0].burned).toEqual(tokens[0].burned);
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

  testActivity(cw721Activity: CW721Activity, actual: any) {
    expect(cw721Activity.sender).toEqual(actual.sender);
    expect(cw721Activity.from).toEqual(actual.from);
    expect(cw721Activity.to).toEqual(actual.to);
    expect(cw721Activity.height).toEqual(actual.height);
    expect(cw721Activity.tx_hash).toEqual(actual.tx_hash);
    expect(cw721Activity.action).toEqual(actual.action);
    expect(cw721Activity.cw721_contract_id).toEqual(actual.cw721_contract_id);
    expect(cw721Activity.cw721_token_id).toEqual(actual.cw721_token_id);
  }
}
