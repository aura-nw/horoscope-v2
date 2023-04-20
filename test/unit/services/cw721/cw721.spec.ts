import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import CodeId from '../../../../src/models/code_id';
import CW721Token from '../../../../src/models/cw721_token';
import CW721Contract from '../../../../src/models/cw721_contract';
import { BULL_JOB_NAME } from '../../../../src/common';
import knex from '../../../../src/common/utils/db_connection';
import { Block, Transaction } from '../../../../src/models';
import config from '../../../../config.json' assert { type: 'json' };
import Cw721HandlerService from '../../../../src/services/cw721/cw721.service';

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
        last_updated_height: 1000,
      },
      {
        token_id: 'token_id2',
        token_uri: 'token_uri',
        extension: null,
        owner: 'owner2',
        contract_address: 'mock_contract_address',
        last_updated_height: 2000,
      },
    ],
  };

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
                {
                  _id: '642266867cace8e64d9b637d',
                  type: 'wasm',
                  attributes: [
                    {
                      _id: '642266867cace800f59b637e',
                      key: '_contract_address',
                      value:
                        'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8xe8',
                    },
                    {
                      _id: '642266867cace800f59b637e',
                      key: 'action',
                      value: 'phamphong_action',
                    },
                    {
                      _id: '642266867cace800f59b637e',
                      key: '_contract_address',
                      value:
                        'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnw456131',
                    },
                    {
                      _id: '642266867cace800f59b637e',
                      key: 'action',
                      value: 'add_mint_phase',
                    },
                    {
                      _id: '642266867cace800f59b637e',
                      key: 'token_id',
                      value: 'test1',
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
                {
                  _id: '642266867cace8e64d9b637d',
                  type: 'wasm',
                  attributes: [
                    {
                      _id: '642266867cace800f59b637e',
                      key: '_contract_address',
                      value:
                        'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8777',
                    },
                    {
                      _id: '642266867cace800f59b637e',
                      key: 'action',
                      value: 'add_whitelist',
                    },
                    {
                      _id: '642266867cace800f59b637e',
                      key: 'token_id',
                      value: 'test2',
                    },
                    {
                      _id: '642266867cace800f59b637e',
                      key: '_contract_address',
                      value:
                        'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8777',
                    },
                    {
                      _id: '642266867cace800f59b637e',
                      key: 'token_id',
                      value: 'test3',
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

  txInsertInstantiate = {};

  codeId = CodeId.fromJson({
    code_id: '100',
    type: 'CW721',
    contract_name: '',
    contract_version: '',
    status: 'VALID',
  });

  @BeforeAll()
  async initSuite() {
    await Promise.all([
      this.cw721HandlerService
        .getQueueManager()
        .getQueue(BULL_JOB_NAME.FILTER_CW721_TRANSACTION)
        .empty(),
    ]);
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE event_attribute, transaction_message, event, transaction, block, block_checkpoint, cw721_token, cw721_contract, cw721_tx, code_id RESTART IDENTITY CASCADE'
    );
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
    await CodeId.query().insert(this.codeId);
    await CW721Contract.query().insertGraph(this.mockInitContract);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Init Env correct')
  public async testInitEnv() {
    config.cw721.startBlock = 0;
    await this.cw721HandlerService.initEnv();
    expect(this.cw721HandlerService._currentAssetHandlerBlock).toEqual(
      this.block.height
    );
    config.cw721.startBlock = 100;
    await this.cw721HandlerService.initEnv();
    expect(this.cw721HandlerService._currentAssetHandlerBlock).toEqual(
      this.block.height
    );
  }

  @Test('test getContractMsgs function')
  public async testGetContractMsgs() {
    const extractData = await this.cw721HandlerService.getContractMsgs(
      this.block.height,
      this.block.height
    );
    expect(
      extractData.map((data) => ({
        action: data.action,
        sender: data.sender,
        contractAddress: data.contractAddress,
        content: data.content,
        wasm_attributes: data.wasm_attributes,
      }))
    ).toEqual([
      {
        action:
          this.txInsert.data.tx_response.logs[0].events[1].attributes[1].value,
        sender: this.txInsert.messages[0].sender,
        contractAddress:
          this.txInsert.data.tx_response.logs[0].events[1].attributes[0].value,
        content: this.txInsert.messages[0].content.msg,
        wasm_attributes: [
          this.txInsert.data.tx_response.logs[0].events[1].attributes[0],
          this.txInsert.data.tx_response.logs[0].events[1].attributes[1],
        ],
      },
      {
        action:
          this.txInsert.data.tx_response.logs[0].events[1].attributes[3].value,
        sender: this.txInsert.messages[0].sender,
        contractAddress:
          this.txInsert.data.tx_response.logs[0].events[1].attributes[2].value,
        content: this.txInsert.messages[0].content.msg,
        wasm_attributes: [
          this.txInsert.data.tx_response.logs[0].events[1].attributes[2],
          this.txInsert.data.tx_response.logs[0].events[1].attributes[3],
          this.txInsert.data.tx_response.logs[0].events[1].attributes[4],
        ],
      },
      {
        action:
          this.txInsert.data.tx_response.logs[1].events[1].attributes[1].value,
        sender: this.txInsert.messages[1].sender,
        contractAddress:
          this.txInsert.data.tx_response.logs[1].events[1].attributes[0].value,
        content: this.txInsert.messages[1].content.msg,
        wasm_attributes: [
          this.txInsert.data.tx_response.logs[1].events[1].attributes[0],
          this.txInsert.data.tx_response.logs[1].events[1].attributes[1],
          this.txInsert.data.tx_response.logs[1].events[1].attributes[2],
        ],
      },
      {
        action: undefined,
        sender: this.txInsert.messages[1].sender,
        contractAddress:
          this.txInsert.data.tx_response.logs[1].events[1].attributes[0].value,
        content: this.txInsert.messages[1].content.msg,
        wasm_attributes: [
          this.txInsert.data.tx_response.logs[1].events[1].attributes[3],
          this.txInsert.data.tx_response.logs[1].events[1].attributes[4],
        ],
      },
    ]);
  }

  @Test('test jobHandlerCw721Transfer')
  public async testjobHandlerCw721Transfer() {
    const mockContractTransferMsg = [
      {
        contractAddress: this.mockInitContract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.address,
          },
          {
            _id: '63fda557271e5f2e69321149',
            key: 'action',
            value: 'transfer_nft',
          },
          {
            _id: '63fda557271e5f2b7a32114a',
            key: 'recipient',
            value: 'phamphong_transfer',
          },
          {
            _id: '63fda557271e5f515032114b',
            key: 'sender',
            value: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
          },
          {
            _id: '63fda557271e5f65ee32114c',
            key: 'token_id',
            value: this.mockInitContract.tokens[0].token_id,
          },
        ],
        tx: Transaction.fromJson({
          height: 100000,
          hash: '',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
        }),
      },
      {
        contractAddress: this.mockInitContract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.address,
          },
          {
            _id: '63fda557271e5f2e69321149',
            key: 'action',
            value: 'transfer_nft',
          },
          {
            _id: '63fda557271e5f2b7a32114a',
            key: 'recipient',
            value: 'phamphong_transfer2',
          },
          {
            _id: '63fda557271e5f515032114b',
            key: 'sender',
            value: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
          },
          {
            _id: '63fda557271e5f65ee32114c',
            key: 'token_id',
            value: this.mockInitContract.tokens[1].token_id,
          },
        ],
        tx: Transaction.fromJson({
          height: 200000,
          hash: '',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
        }),
      },
    ];
    await this.cw721HandlerService.handlerCw721Transfer(
      mockContractTransferMsg
    );
    const token1 = await CW721Token.query()
      .where('contract_address', this.mockInitContract.address)
      .andWhere('token_id', this.mockInitContract.tokens[0].token_id)
      .first();
    const token2 = await CW721Token.query()
      .where('contract_address', this.mockInitContract.address)
      .andWhere('token_id', this.mockInitContract.tokens[1].token_id)
      .first();
    expect(token1?.owner).toEqual(
      mockContractTransferMsg[0].wasm_attributes[2].value
    );
    expect(token2?.owner).toEqual(
      mockContractTransferMsg[1].wasm_attributes[2].value
    );
  }

  @Test('test jobHandlerCw721Mint')
  public async testjobHandlerCw721Mint() {
    const mockContractMintMsg = [
      {
        contractAddress: this.mockInitContract.address,
        sender: '',
        action: 'transfer_nft',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.address,
          },
          {
            _id: '63fda557271e5f2e69321149',
            key: 'action',
            value: 'mint',
          },
          {
            _id: '63f82910dda9e6288755bd8a',
            key: 'minter',
            value: 'aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx',
          },
          {
            _id: '63f82910dda9e626e055bd8b',
            key: 'owner',
            value: 'phamphong_test_mint',
          },
          {
            _id: '63fda557271e5f65ee32114c',
            key: 'token_id',
            value: 'bump',
          },
        ],
        tx: Transaction.fromJson({
          height: 100000,
          hash: '',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
        }),
      },
      {
        contractAddress: this.mockInitContract.address,
        sender: '',
        action: 'transfer_nft',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.address,
          },
          {
            _id: '63fda557271e5f2e69321149',
            key: 'action',
            value: 'mint',
          },
          {
            _id: '63f82910dda9e6288755bd8a',
            key: 'minter',
            value: 'aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx',
          },
          {
            _id: '63f82910dda9e626e055bd8b',
            key: 'owner',
            value: 'phamphong_test_mint2',
          },
          {
            _id: '63fda557271e5f65ee32114c',
            key: 'token_id',
            value: 'nunu',
          },
        ],
        tx: Transaction.fromJson({
          height: 200000,
          hash: '',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
        }),
      },
    ];
    await this.cw721HandlerService.handlerCw721Mint(mockContractMintMsg);
    const token1 = await CW721Token.query()
      .where(
        'contract_address',
        this.mockInitContract.tokens[0].contract_address
      )
      .andWhere('token_id', mockContractMintMsg[0].wasm_attributes[4].value)
      .first();
    const token2 = await CW721Token.query()
      .where(
        'contract_address',
        this.mockInitContract.tokens[1].contract_address
      )
      .andWhere('token_id', mockContractMintMsg[1].wasm_attributes[4].value)
      .first();
    expect(token1?.owner).toEqual(
      mockContractMintMsg[0].wasm_attributes[3].value
    );
    expect(token2?.owner).toEqual(
      mockContractMintMsg[1].wasm_attributes[3].value
    );
  }

  @Test('test jobHandlerCw721Burn')
  public async testjobHandlerCw721Burn() {
    const mockBurnMsg = [
      {
        contractAddress: this.mockInitContract.address,
        sender: '',
        action: 'burn',
        content: '',
        wasm_attributes: [
          {
            _id: '63a55d044c1864001244a47b',
            key: '_contract_address',
            value: this.mockInitContract.tokens[0].contract_address,
          },
          {
            _id: '63a55d044c1864001244a47c',
            key: 'action',
            value: 'burn',
          },
          {
            _id: '63a55d044c1864001244a47d',
            key: 'sender',
            value: 'aura15f6wn3nymdnhnh5ddlqletuptjag09tryrtpq5',
          },
          {
            _id: '63a55d044c1864001244a47e',
            key: 'token_id',
            value: this.mockInitContract.tokens[0].token_id,
          },
        ],
        tx: Transaction.fromJson({
          height: 500000,
          hash: '',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
        }),
      },
      {
        contractAddress: this.mockInitContract.address,
        sender: '',
        action: 'burn',
        content: '',
        wasm_attributes: [
          {
            _id: '63a55d044c1864001244a47b',
            key: '_contract_address',
            value: this.mockInitContract.tokens[1].contract_address,
          },
          {
            _id: '63a55d044c1864001244a47c',
            key: 'action',
            value: 'burn',
          },
          {
            _id: '63a55d044c1864001244a47d',
            key: 'sender',
            value: 'aura15f6wn3nymdnhnh5ddlqletuptjag09tryrtpq5',
          },
          {
            _id: '63a55d044c1864001244a47e',
            key: 'token_id',
            value: this.mockInitContract.tokens[1].token_id,
          },
        ],
        tx: Transaction.fromJson({
          height: 500000,
          hash: '',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
        }),
      },
    ];
    await this.cw721HandlerService.handlerCw721Burn(mockBurnMsg);
    const token1 = await CW721Token.query()
      .where('contract_address', this.mockInitContract.address)
      .andWhere('token_id', this.mockInitContract.tokens[0].token_id)
      .first();
    const token2 = await CW721Token.query()
      .where('contract_address', this.mockInitContract.address)
      .andWhere('token_id', this.mockInitContract.tokens[1].token_id)
      .first();
    expect(token1?.burned).toEqual(true);
    expect(token2?.burned).toEqual(true);
  }

  @Test('test handlerCw721Instantiate')
  public async testHandlerCw721Instantiate() {
    const content = {
      name: 'Base Contract 2',
      symbol: 'BASEZ',
      minter: 'aura1ahwqzlu0wzd0uyp53x6l2ygftxmquy57tz6jj5',
    };
    const mockInstantiateMsg = [
      {
        contractAddress: 'phamphong_test_instantiate',
        sender: '',
        action: 'instantiate',
        content: JSON.stringify(content),
        wasm_attributes: [],
        tx: Transaction.fromJson({
          height: 300000,
          hash: '',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
        }),
        code_id: '100',
      },
    ];
    await this.cw721HandlerService.handleInstantiateMsgs(mockInstantiateMsg);
    const contract = await CW721Contract.query()
      .where('address', mockInstantiateMsg[0].contractAddress)
      .first();
    expect(contract?.minter).toEqual(content.minter);
    expect(contract?.name).toEqual(content.name);
    expect(contract?.symbol).toEqual(content.symbol);
    expect(contract?.code_id).toEqual(mockInstantiateMsg[0].code_id);
  }

  @Test('test handle conflict')
  public async testHandleConflict() {
    const mockToken = {
      token_id: 'test conflict',
      token_uri: null,
      extension: null,
      owner: 'phamphong_test',
      contract_address: this.mockInitContract.address,
      last_updated_height: 12345678,
    };
    const conflictOwner = 'phamphong_test_conflict';
    await CW721Token.query().insert(
      CW721Token.fromJson({
        ...mockToken,
      })
    );
    const mergeToken = await CW721Token.query()
      .insertAndFetch(
        CW721Token.fromJson({
          ...mockToken,
          owner: conflictOwner,
        })
      )
      .onConflict(['token_id', 'contract_address', 'last_updated_height'])
      .merge();
    expect(mergeToken.owner).toEqual(conflictOwner);
  }
}
