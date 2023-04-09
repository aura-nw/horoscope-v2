import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import CW721Token from '../../../../src/models/cw721_token';
import CW721Contract from '../../../../src/models/cw721_contract';
import { BULL_JOB_NAME } from '../../../../src/common';
import knex from '../../../../src/common/utils/db_connection';
import { Block, Transaction } from '../../../../src/models';
import Cw721HandlerService from '../../../../src/services/cw721/cw721.service';
import config from '../../../../config.json' assert { type: 'json' };

@Describe('Test cw721 service')
export default class AssetIndexerTest {
  broker = new ServiceBroker({ logger: false });

  mockInitContract = {
    ...CW721Contract.fromJson({
      code_id: 'code_id',
      address: 'mock_contract_address',
      name: 'name',
      symbol: 'symbol',
      minter: 'minter',
    }),
    tokens: [
      {
        token_id: 'token_id1',
        token_uri: 'token_uri',
        extension: null,
        owner: 'owner1',
        contract_address: 'mock_contract_address',
      },
      {
        token_id: 'token_id2',
        token_uri: 'token_uri',
        extension: null,
        owner: 'owner2',
        contract_address: 'mock_contract_address',
      },
    ],
  };

  mockContractMintMsg = [
    {
      contractAddress:
        'aura1jr5vg70d3wq7mp5yms2p8s4337p54zxdhympdh67p95dw69us84sdm2rmk',
      sender: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
      action: 'mint',
      txhash:
        'CCB1BA7C3D3AAE293645787CEE0408DEE42F529AFCF7C8F7F93CBB4AE7ED28B6',
      tokenid: '1677142001007',
    },
    {
      contractAddress:
        'aura1lpp4qfcvlyl0uv97xgzgnhar6q0qlw54n23e2u3ul3pmyr0nal9sg4cu44',
      sender: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
      action: 'mint',
      txhash:
        'DEF522CDF8791F88BC000D24C31387C03D3ACBBE38BC1BD1CA415424B520F446',
      tokenid: '1677142001017',
    },
  ];

  cw721HandlerService = this.broker.createService(
    Cw721HandlerService
  ) as Cw721HandlerService;

  block: Block = Block.fromJson({
    height: 3967530,
    hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9F',
    time: '2023-01-12T01:53:57.216Z',
    proposer_address: 'auraomd;cvpio3j4eg',
    data: {},
  });

  txInsert = {
    ...Transaction.fromJson({
      height: 3967530,
      hash: '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997D',
      codespace: '',
      code: 0,
      gas_used: '123035',
      gas_wanted: '141106',
      gas_limit: '141106',
      fee: 353,
      timestamp: '2023-01-12T01:53:57.000Z',
      data: {
        tx_response: {
          logs: [
            {
              msg_index: 0,
              log: '',
              events: [
                {
                  _id: '642266867cace8e64d9b637d',
                  type: 'execute',
                  attributes: [
                    {
                      _id: '642266867cace800f59b637e',
                      key: '_contract_address',
                      value:
                        'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8xe8',
                    },
                    {
                      _id: '642266867cace800f59b637e',
                      key: '_contract_address',
                      value:
                        'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnw456131',
                    },
                  ],
                },
              ],
            },
            {
              msg_index: 0,
              log: '',
              events: [
                {
                  _id: '642266867cace8e64d9b637d',
                  type: 'execute',
                  attributes: [
                    {
                      _id: '642266867cace800f59b637e',
                      key: '_contract_address',
                      value:
                        'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8777',
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    }),
    messages: [
      {
        index: 1,
        type: '/cosmwasm.wasm.v1.MsgExecuteContract',
        sender: 'aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n',
        content: {
          msg: '{"add_mint_phase":{"phase_data":{"start_time":"1679976124941000000","end_time":"1679982024941000000","max_supply":2000,"max_nfts_per_address":20,"price":{"amount":"10","denom":"ueaura"},"is_public":false},"token_id": "test"}}',
          '@type': '/cosmwasm.wasm.v1.MsgExecuteContract',
          funds: [],
          sender: 'aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n',
          contract:
            'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8xe8',
        },
      },
      {
        index: 2,
        type: '/cosmwasm.wasm.v1.MsgExecuteContract',
        sender: 'aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n',
        content: {
          msg: '{"add_whitelist":{"phase_id":1,"whitelists":["aura1fqj2redmssckrdeekhkcvd2kzp9f4nks4fctrt"]}}',
          '@type': '/cosmwasm.wasm.v1.MsgExecuteContract',
          funds: [],
          sender: 'aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n',
          contract:
            'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8777',
        },
      },
    ],
  };

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    await Promise.all([
      this.cw721HandlerService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.FILTER_CW721_TRANSACTION)
        .empty(),
      this.cw721HandlerService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_CW721_BURN)
        .empty(),
      this.cw721HandlerService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_CW721_MINT)
        .empty(),
      this.cw721HandlerService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.HANDLE_CW721_TRANSFER)
        .empty(),
    ]);
    await knex.raw(
      'TRUNCATE TABLE transaction_event_attribute, transaction_message, transaction_event, transaction, block, block_checkpoint, cw721_token, cw721_contract, cw721_tx RESTART IDENTITY CASCADE'
    );
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
    await CW721Contract.query().insertGraph(this.mockInitContract);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Init Env correct')
  public async testInitEnv() {
    config.cw721.assetStartTxId = 0;
    await this.cw721HandlerService.initEnv();
    expect(this.cw721HandlerService._currentAssetHandlerTx).toEqual(1);
    config.cw721.assetStartTxId = 100;
    await this.cw721HandlerService.initEnv();
    expect(this.cw721HandlerService._currentAssetHandlerTx).toEqual(1);
  }

  @Test('test getContractMsgs function')
  public async testGetContractMsgs() {
    const extractData = await this.cw721HandlerService.getContractMsgs(1, 2);
    expect(extractData).toEqual([
      {
        action: 'add_mint_phase',
        sender: this.txInsert.messages[0].sender,
        contractAddress:
          this.txInsert.data.tx_response.logs[0].events[0].attributes[0].value,
        txhash: this.txInsert.hash,
        tokenid: 'test',
      },
      {
        action: 'add_whitelist',
        sender: this.txInsert.messages[1].sender,
        contractAddress:
          this.txInsert.data.tx_response.logs[1].events[0].attributes[0].value,
        txhash: this.txInsert.hash,
        tokenid: undefined,
      },
    ]);
  }

  @Test('test jobHandlerCw721Transfer')
  public async testjobHandlerCw721Transfer() {
    const mockReslut = [
      {
        owner: 'phamphong_transfer1',
        token_uri: 'http://...',
        extension: {},
      },
      {
        owner: 'phamphong_transfer2',
        token_uri: 'http://...',
        extension: {},
      },
    ];
    this.cw721HandlerService.getTokenInfoForListMsg = jest.fn(() =>
      Promise.resolve(mockReslut)
    );
    await this.cw721HandlerService.jobHandlerCw721Transfer([
      {
        contractAddress: this.mockInitContract.address,
        sender: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
        action: 'transfer',
        txhash: '',
        tokenid: 'token_id1',
      },
      {
        contractAddress: this.mockInitContract.address,
        sender: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
        action: 'transfer',
        txhash: '',
        tokenid: 'token_id2',
      },
    ]);
    const token1 = await CW721Token.query()
      .where('contract_address', this.mockInitContract.address)
      .andWhere('token_id', this.mockInitContract.tokens[0].token_id)
      .first();
    const token2 = await CW721Token.query()
      .where('contract_address', this.mockInitContract.address)
      .andWhere('token_id', this.mockInitContract.tokens[1].token_id)
      .first();
    expect(token1?.owner).toEqual(mockReslut[0].owner);
    expect(token2?.owner).toEqual(mockReslut[1].owner);
  }

  @Test('test jobHandlerCw721Mint')
  public async testjobHandlerCw721Mint() {
    const mockMintMsg = [
      {
        contractAddress: this.mockInitContract.address,
        sender: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
        action: 'mint',
        txhash: '',
        tokenid: 'token_id_mint_1',
      },
      {
        contractAddress: this.mockInitContract.address,
        sender: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
        action: 'mint',
        txhash: '',
        tokenid: 'token_id_mint_2',
      },
    ];
    const mockReslut = [
      {
        owner: 'phamphong_mint1',
        token_uri: 'http://...',
        extension: {},
      },
      {
        owner: 'phamphong_mint2',
        token_uri: 'http://...',
        extension: {},
      },
    ];
    this.cw721HandlerService.getTokenInfoForListMsg = jest.fn(() =>
      Promise.resolve(mockReslut)
    );
    await this.cw721HandlerService.jobHandlerCw721Mint(mockMintMsg);
    const token1 = await CW721Token.query()
      .where('contract_address', mockMintMsg[0].contractAddress)
      .andWhere('token_id', mockMintMsg[0].tokenid)
      .first();
    const token2 = await CW721Token.query()
      .where('contract_address', mockMintMsg[1].contractAddress)
      .andWhere('token_id', mockMintMsg[1].tokenid)
      .first();
    expect(token1?.owner).toEqual(mockReslut[0].owner);
    expect(token2?.owner).toEqual(mockReslut[1].owner);
  }

  @Test('test jobHandlerCw721Burn')
  public async testjobHandlerCw721Burn() {
    const mockBurnMsg = [
      {
        contractAddress: this.mockInitContract.address,
        sender: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
        action: 'burn',
        txhash: '',
        tokenid: this.mockInitContract.tokens[0].token_id,
      },
    ];
    await this.cw721HandlerService.jobHandlerCw721Burn(mockBurnMsg);
    const token1 = await CW721Token.query()
      .where('contract_address', this.mockInitContract.address)
      .andWhere('token_id', this.mockInitContract.tokens[0].token_id)
      .first();
    expect(token1?.delete_at).not.toBeNull();
  }

  @Test('test handlerCw721Instantiate')
  public async testHandlerCw721Instantiate() {
    const mockInstantiateMsg = [
      {
        contractAddress: 'instantiate_contract',
        sender: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
        action: 'instantiate',
        txhash: '',
        codeid: 'hihi',
        contractType: 'CW721',
      },
    ];
    const mockMinterAndTokenInfo = [
      {
        name: 'instantiate_name',
        symbol: 'instantiate_symbol',
        minter: 'instantiate_minter',
      },
    ];
    this.cw721HandlerService.getContractInfoAndMinterForBatchContract = jest.fn(
      () => Promise.resolve(mockMinterAndTokenInfo)
    );
    await this.cw721HandlerService.handleInstantiateMsgs(mockInstantiateMsg);
    const contract = await CW721Contract.query()
      .where('address', mockInstantiateMsg[0].contractAddress)
      .first();
    expect(contract?.minter).toEqual(mockMinterAndTokenInfo[0].minter);
    expect(contract?.name).toEqual(mockMinterAndTokenInfo[0].name);
    expect(contract?.symbol).toEqual(mockMinterAndTokenInfo[0].symbol);
    expect(contract?.code_id).toEqual(mockInstantiateMsg[0].codeid);
  }
}
