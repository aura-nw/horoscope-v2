import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import config from '../../../../config.json' assert { type: 'json' };
import knex from '../../../../src/common/utils/db_connection';
import { Block, Transaction } from '../../../../src/models';
import { Code } from '../../../../src/models/code';
import CW721Contract from '../../../../src/models/cw721_contract';
import CW721Token from '../../../../src/models/cw721_token';
import CW721Activity from '../../../../src/models/cw721_tx';
import Cw721HandlerService from '../../../../src/services/cw721/cw721.service';

@Describe('Test cw721 service')
export default class AssetIndexerTest {
  broker = new ServiceBroker({ logger: false });

  mockInitContract = {
    ...CW721Contract.fromJson({
      contract_id: 1,
      symbol: 'symbol',
      minter: 'minter',
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
      index: 0,
      data: {
        tx_response: {
          logs: [],
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
        events: [
          {
            type: 'execute',
            block_height: 3967530,
            source: 'TX_EVENT',
            attributes: [
              {
                index: 0,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value:
                  'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8xe8',
              },
              {
                index: 1,
                block_height: 3967530,
                // tx_id: 1,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value:
                  'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnw456131',
              },
            ],
          },
          {
            block_height: 3967530,
            source: 'TX_EVENT',
            type: 'instantiate',
            attributes: [
              {
                index: 0,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value:
                  'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8777',
              },
              {
                index: 1,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: 'code_id',
                value: '6',
              },
              {
                index: 2,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value:
                  'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8777',
              },
              {
                index: 3,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: 'code_id',
                value: '2',
              },
            ],
          },
          {
            block_height: 3967530,
            source: 'TX_EVENT',
            type: 'wasm',
            attributes: [
              {
                index: 0,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value:
                  'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8xe8',
              },
              {
                index: 1,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: 'action',
                value: 'phamphong_action',
              },
              {
                index: 2,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value:
                  'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnw456131',
              },
              {
                index: 3,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: 'action',
                value: 'add_mint_phase',
              },
              {
                index: 4,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: 'token_id',
                value: 'test1',
              },
            ],
          },
        ],
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
        events: [
          {
            block_height: 3967530,
            source: 'TX_EVENT',
            type: 'execute',
            attributes: [
              {
                index: 0,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value:
                  'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8777',
              },
            ],
          },
          {
            block_height: 3967530,
            source: 'TX_EVENT',
            type: 'wasm',
            attributes: [
              {
                index: 0,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value:
                  'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8777',
              },
              {
                index: 1,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: 'action',
                value: 'add_whitelist',
              },
              {
                index: 2,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: 'token_id',
                value: 'test2',
              },
              {
                index: 3,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value:
                  'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8777',
              },
              {
                index: 4,
                block_height: 3967530,
                composite_key: 'execute._contract_address',
                key: 'token_id',
                value: 'test3',
              },
            ],
          },
        ],
      },
    ],
  };

  txInsertInstantiate = {};

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
    // contracts: [
    //   {
    //     name: 'Base Contract 2',
    //     address: 'mock_contract_address',
    //     creator: 'phamphong_creator',
    //     code_id: 100,
    //     instantiate_hash: 'abc',
    //     instantiate_height: 300000,
    //   },
    //   {
    //     code_id: 100,
    //     address: 'mock_contract_address_2',
    //     name: 'name',
    //     creator: 'phamphong_creator 2',
    //     instantiate_hash: 'abc',
    //     instantiate_height: 300000,
    //   },
    // ],
  };

  @BeforeAll()
  async initSuite() {
    this.cw721HandlerService.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE event_attribute, transaction_message, event, transaction, block, block_checkpoint, cw721_token, cw721_contract, cw721_activity, code RESTART IDENTITY CASCADE'
    );
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
    await Code.query().insertGraph(this.codeId);
    await CW721Contract.query().insertGraph(this.mockInitContract);
    await CW721Contract.query().insertGraph(this.mockInitContract_2);
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

  @Test('test getContractActivities function')
  public async testGetContractActivities() {
    const extractData = await this.cw721HandlerService.getContractActivities(
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
        action: 'instantiate',
        sender: this.txInsert.messages[0].sender,
        contractAddress:
          this.txInsert.messages[0].events[1].attributes[0].value,
        content: this.txInsert.messages[0].content.msg,
        wasm_attributes: [
          this.txInsert.messages[0].events[1].attributes[0],
          this.txInsert.messages[0].events[1].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: 'instantiate',
        sender: this.txInsert.messages[0].sender,
        contractAddress:
          this.txInsert.messages[0].events[1].attributes[0].value,
        content: this.txInsert.messages[0].content.msg,
        wasm_attributes: [
          this.txInsert.messages[0].events[1].attributes[2],
          this.txInsert.messages[0].events[1].attributes[3],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: this.txInsert.messages[0].events[2].attributes[1].value,
        sender: this.txInsert.messages[0].sender,
        contractAddress:
          this.txInsert.messages[0].events[2].attributes[0].value,
        content: this.txInsert.messages[0].content.msg,
        wasm_attributes: [
          this.txInsert.messages[0].events[2].attributes[0],
          this.txInsert.messages[0].events[2].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: this.txInsert.messages[0].events[2].attributes[3].value,
        sender: this.txInsert.messages[0].sender,
        contractAddress:
          this.txInsert.messages[0].events[2].attributes[2].value,
        content: this.txInsert.messages[0].content.msg,
        wasm_attributes: [
          this.txInsert.messages[0].events[2].attributes[2],
          this.txInsert.messages[0].events[2].attributes[3],
          this.txInsert.messages[0].events[2].attributes[4],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: this.txInsert.messages[1].events[1].attributes[1].value,
        sender: this.txInsert.messages[1].sender,
        contractAddress:
          this.txInsert.messages[1].events[1].attributes[0].value,
        content: this.txInsert.messages[1].content.msg,
        wasm_attributes: [
          this.txInsert.messages[1].events[1].attributes[0],
          this.txInsert.messages[1].events[1].attributes[1],
          this.txInsert.messages[1].events[1].attributes[2],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: undefined,
        sender: this.txInsert.messages[1].sender,
        contractAddress:
          this.txInsert.messages[1].events[1].attributes[0].value,
        content: this.txInsert.messages[1].content.msg,
        wasm_attributes: [
          this.txInsert.messages[1].events[1].attributes[3],
          this.txInsert.messages[1].events[1].attributes[4],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
    ]);
  }

  @Test('test jobHandlerCw721Transfer')
  public async testjobHandlerCw721Transfer() {
    const mockContractTransferMsg = [
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            _id: '63fda557271e5f2e69321149',
            key: 'action',
            value: 'transfer_nft',
          },
          {
            _id: '63fda557271e5f2b7a32114a',
            key: 'recipient',
            value: 'phamphong_duplicate',
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
          index: 0,
        }),
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
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
          index: 0,
        }),
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
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
          index: 0,
        }),
      },
    ];
    await this.cw721HandlerService.handlerCw721Transfer(
      mockContractTransferMsg
    );
    const token1 = await CW721Token.query()
      .where('cw721_contract_id', 1)
      .andWhere('token_id', this.mockInitContract.tokens[0].token_id)
      .first();
    const token2 = await CW721Token.query()
      .where('cw721_contract_id', 1)
      .andWhere('token_id', this.mockInitContract.tokens[1].token_id)
      .first();
    expect(token1?.owner).toEqual(
      mockContractTransferMsg[1].wasm_attributes[2].value
    );
    expect(token2?.owner).toEqual(
      mockContractTransferMsg[2].wasm_attributes[2].value
    );
  }

  @Test('test jobHandlerCw721Mint')
  public async testjobHandlerCw721Mint() {
    const mockContractMintMsg = [
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
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
          index: 0,
        }),
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
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
          index: 0,
        }),
      },
    ];
    await this.cw721HandlerService.handlerCw721Mint(mockContractMintMsg);
    const token1 = await CW721Token.query()
      .where(
        'cw721_contract_id',
        this.mockInitContract.tokens[0].cw721_contract_id
      )
      .andWhere('token_id', mockContractMintMsg[0].wasm_attributes[4].value)
      .first();
    const token2 = await CW721Token.query()
      .where(
        'cw721_contract_id',
        this.mockInitContract.tokens[1].cw721_contract_id
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
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'burn',
        content: '',
        wasm_attributes: [
          {
            _id: '63a55d044c1864001244a47b',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
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
          index: 0,
        }),
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'burn',
        content: '',
        wasm_attributes: [
          {
            _id: '63a55d044c1864001244a47b',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
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
          index: 0,
        }),
      },
    ];
    await this.cw721HandlerService.handlerCw721Burn(mockBurnMsg);
    const token1 = await CW721Token.query()
      .where(
        'cw721_contract_id',
        this.mockInitContract.tokens[0].cw721_contract_id
      )
      .andWhere('token_id', this.mockInitContract.tokens[0].token_id)
      .first();
    const token2 = await CW721Token.query()
      .where(
        'cw721_contract_id',
        this.mockInitContract.tokens[0].cw721_contract_id
      )
      .andWhere('token_id', this.mockInitContract.tokens[1].token_id)
      .first();
    expect(token1?.burned).toEqual(true);
    expect(token2?.burned).toEqual(true);
  }

  @Test('test Cw721 Re-Mint')
  public async testhandlerCw721ReMint() {
    const mockContractMintMsg = [
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'mint',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            _id: '63fda557271e5f2e69321149',
            key: 'action',
            value: 'mint',
          },
          {
            _id: '63f82910dda9e6288755bd8a',
            key: 'minter',
            value: 'pham_phong_re_mint_minter',
          },
          {
            _id: '63f82910dda9e626e055bd8b',
            key: 'owner',
            value: 'phamphong_test_re_mint_owner',
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
          index: 0,
        }),
      },
    ];
    const burnedToken = await CW721Token.query()
      .where(
        'cw721_contract_id',
        this.mockInitContract.tokens[0].cw721_contract_id
      )
      .andWhere('token_id', mockContractMintMsg[0].wasm_attributes[4].value)
      .first();
    expect(burnedToken?.burned).toEqual(true);
    expect(burnedToken?.media_info).toEqual(
      this.mockInitContract.tokens[0].media_info
    );
    await this.cw721HandlerService.handlerCw721Mint(mockContractMintMsg);
    const reMintedToken = await CW721Token.query()
      .where(
        'cw721_contract_id',
        this.mockInitContract.tokens[0].cw721_contract_id
      )
      .andWhere('token_id', mockContractMintMsg[0].wasm_attributes[4].value)
      .first();
    expect(reMintedToken?.owner).toEqual(
      mockContractMintMsg[0].wasm_attributes[3].value
    );
    expect(reMintedToken?.id).toEqual(burnedToken?.id);
    expect(reMintedToken?.media_info).toEqual(null);
    expect(reMintedToken?.burned).toEqual(false);
  }

  @Test('test handlerCw721Instantiate')
  public async testHandlerCw721Instantiate() {
    const mockContractsInfo = [
      {
        address: this.mockInitContract.smart_contract.address,
        name: this.mockInitContract.smart_contract.name,
        symbol: 'symbol_1',
        minter: 'minter_1',
      },
    ];
    this.cw721HandlerService.getContractsInfo = jest.fn(() =>
      Promise.resolve(mockContractsInfo)
    );
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const codeId: number = this.codeId.code_id;
    const mockInstantiateMsg = [
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'instantiate',
        content: '',
        wasm_attributes: [],
        tx: Transaction.fromJson({
          height: this.mockInitContract.smart_contract.instantiate_height,
          hash: this.mockInitContract.smart_contract.instantiate_hash,
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
          index: 0,
        }),
        code_id: codeId,
      },
    ];
    await this.cw721HandlerService.handleInstantiateMsgs(mockInstantiateMsg);
    const contract = await CW721Contract.query()
      .alias('cw721_contract')
      .withGraphJoined('smart_contract')
      .where('cw721_contract.contract_id', this.mockInitContract.contract_id)
      .select(
        'smart_contract.name as name',
        'cw721_contract.minter as minter',
        'cw721_contract.symbol as symbol'
      )
      .first();
    expect(contract?.minter).toEqual(mockContractsInfo[0].minter);
    expect(contract?.symbol).toEqual(mockContractsInfo[0].symbol);
    expect(contract?.name).toEqual(mockContractsInfo[0].name);
  }

  @Test('test handle conflict')
  public async testHandleConflict() {
    const mockToken = {
      token_id: 'test conflict',
      media_info: null,
      owner: 'phamphong_test',
      cw721_contract_id: this.mockInitContract.tokens[0].cw721_contract_id,
      last_updated_height: 12345678,
    };
    const conflictOwner = 'phamphong_test_conflict';
    const token = await CW721Token.query().insertAndFetch(
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
      .onConflict(['token_id', 'cw721_contract_id'])
      .merge();
    expect(mergeToken.owner).toEqual(conflictOwner);
    expect(token.id).toEqual(mergeToken.id);
  }

  @Test('test getCw721TokensRecords')
  public async getCw721TokensRecords() {
    const mockTokens = [
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        onchainTokenId: 'token_id1',
        id: 1,
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        onchainTokenId: 'token_id2',
        id: 2,
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        onchainTokenId: 'bump',
        id: 5,
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        onchainTokenId: 'nunu',
        id: 6,
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        onchainTokenId: 'test conflict',
        id: 8,
      },
      {
        contractAddress: this.mockInitContract_2.smart_contract.address,
        onchainTokenId: 'token_id1',
        id: 3,
      },
      {
        contractAddress: this.mockInitContract_2.smart_contract.address,
        onchainTokenId: 'token_id3',
        id: null,
      },
    ];
    const results = await this.cw721HandlerService.getCw721TokensRecords(
      mockTokens
    );
    mockTokens.forEach((token, index) => {
      const result = results.find(
        (item) =>
          item.contract_address === token.contractAddress &&
          item.token_id === token.onchainTokenId
      );
      if (index !== mockTokens.length - 1) {
        expect(result?.contract_address).toEqual(token.contractAddress);
        expect(result?.token_id).toEqual(token.onchainTokenId);
        expect(result?.cw721_token_id).toEqual(token.id);
      } else {
        expect(result).toBeUndefined();
      }
    });
  }

  @Test('test getCw721ContractsRecords')
  public async testGetCw721ContractsRecords() {
    const results = await this.cw721HandlerService.getCw721ContractsRecords([
      this.mockInitContract.smart_contract.address,
    ]);
    expect(results[0].address).toEqual(
      this.mockInitContract.smart_contract.address
    );
    expect(results[0].id).toEqual(1);
  }

  @Test('test handle activity')
  public async testHandleActivity() {
    const mockActivityMsgs = [
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'mint',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            _id: '63fda557271e5f2e69321149',
            key: 'action',
            value: 'mint',
          },
          {
            _id: '63f82910dda9e6288755bd8a',
            key: 'minter',
            value: 'pham_phong_re_mint_minter',
          },
          {
            _id: '63f82910dda9e626e055bd8b',
            key: 'owner',
            value: 'phamphong_test_re_mint_owner',
          },
          {
            _id: '63fda557271e5f65ee32114c',
            key: 'token_id',
            value: this.mockInitContract.tokens[0].token_id,
          },
        ],
        tx: Transaction.fromJson({
          height: 100000,
          hash: 'cxvxcvxcvxcbvxcb',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
          index: 0,
        }),
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
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
        ],
        tx: Transaction.fromJson({
          height: 100000,
          hash: 'fghgfhgfhfhdf',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
          index: 0,
        }),
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'burn',
        content: '',
        wasm_attributes: [
          {
            _id: '63a55d044c1864001244a47b',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
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
          hash: 'sdfdasrqewrasdEWEQE',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
          index: 0,
        }),
      },
    ];
    await this.cw721HandlerService.handleCW721Activity(mockActivityMsgs);
    const cw721Activities = await CW721Activity.query();
    cw721Activities.forEach((cw721Activity, index) => {
      expect(cw721Activity.action).toEqual(mockActivityMsgs[index].action);
      expect(cw721Activity.cw721_contract_id).toEqual(
        this.mockInitContract.tokens[0].cw721_contract_id
      );
      expect(cw721Activity.tx_hash).toEqual(mockActivityMsgs[index].tx.hash);
    });
    expect(cw721Activities[0].cw721_token_id).toEqual(1);
    expect(cw721Activities[1].cw721_token_id).toEqual(0);
    expect(cw721Activities[2].cw721_token_id).toEqual(2);
  }

  @Test('test remove duplicate')
  async testRemoveDuplicate() {
    const mockContractEvents = [
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'mint',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            _id: '63fda557271e5f2e69321149',
            key: 'action',
            value: 'mint',
          },
          {
            _id: '63f82910dda9e6288755bd8a',
            key: 'minter',
            value: 'pham_phong_re_mint_minter',
          },
          {
            _id: '63f82910dda9e626e055bd8b',
            key: 'owner',
            value: 'phamphong_test_re_mint_owner',
          },
          {
            _id: '63fda557271e5f65ee32114c',
            key: 'token_id',
            value: this.mockInitContract.tokens[0].token_id,
          },
        ],
        tx: Transaction.fromJson({
          height: 100000,
          hash: 'cxvxcvxcvxcbvxcb',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
          index: 0,
        }),
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
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
        ],
        tx: Transaction.fromJson({
          height: 100000,
          hash: 'fghgfhgfhfhdf',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
          index: 0,
        }),
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: '',
        action: 'burn',
        content: '',
        wasm_attributes: [
          {
            _id: '63a55d044c1864001244a47b',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
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
          hash: 'sdfdasrqewrasdEWEQE',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
          index: 0,
        }),
      },
      {
        contractAddress: this.mockInitContract.smart_contract.address,
        sender: 'test_duplicate',
        action: 'mint',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        wasm_attributes: [
          {
            _id: '63fda557271e5f3bc9321148',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            _id: '63fda557271e5f2e69321149',
            key: 'action',
            value: 'mint',
          },
          {
            _id: '63f82910dda9e6288755bd8a',
            key: 'minter',
            value: 'pham_phong_re_mint_minter',
          },
          {
            _id: '63f82910dda9e626e055bd8b',
            key: 'owner',
            value: 'phamphong_test_duplicate',
          },
          {
            _id: '63fda557271e5f65ee32114c',
            key: 'token_id',
            value: this.mockInitContract.tokens[0].token_id,
          },
        ],
        tx: Transaction.fromJson({
          height: 100000,
          hash: 'cxvxcvxcvxcbvxcb',
          code: 0,
          gas_used: '123035',
          gas_wanted: '141106',
          gas_limit: '141106',
          fee: 353,
          timestamp: '2023-01-12T01:53:57.000Z',
          codespace: '',
          data: {},
          index: 0,
        }),
      },
    ];
    const contractEvents =
      this.cw721HandlerService.removeDuplicate(mockContractEvents);
    const objectsEqual: any = (o1: any, o2: any) =>
      typeof o1 === 'object' && Object.keys(o1).length > 0
        ? Object.keys(o1).length === Object.keys(o2).length &&
          Object.keys(o1).every((p) => objectsEqual(o1[p], o2[p]))
        : o1 === o2;
    mockContractEvents.shift();
    expect(objectsEqual(contractEvents, mockContractEvents)).toEqual(true);
  }
}
