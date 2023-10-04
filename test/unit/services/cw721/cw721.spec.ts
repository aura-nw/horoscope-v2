import {
  AfterAll,
  AfterEach,
  BeforeAll,
  Describe,
  Test,
} from '@jest-decorated/core';
import _ from 'lodash';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common';
import knex from '../../../../src/common/utils/db_connection';
import {
  getAttributeFrom,
  getContractActivities,
} from '../../../../src/common/utils/smart_contract';
import {
  Block,
  BlockCheckpoint,
  EventAttribute,
  SmartContract,
  Transaction,
} from '../../../../src/models';
import { Code } from '../../../../src/models/code';
import CW721Contract from '../../../../src/models/cw721_contract';
import CW721Token from '../../../../src/models/cw721_token';
import CW721Activity from '../../../../src/models/cw721_tx';
import { SmartContractEvent } from '../../../../src/models/smart_contract_event';
import CrawlContractEventService from '../../../../src/services/crawl-cosmwasm/crawl_contract_event.service';
import Cw721HandlerService from '../../../../src/services/cw721/cw721.service';
import { Cw721Handler } from '../../../../src/services/cw721/cw721_handler';

@Describe('Test cw721 service')
export default class AssetIndexerTest {
  broker = new ServiceBroker({ logger: false });

  blockHeight = 10000;

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

  mockBlockCheckpoint = [
    BlockCheckpoint.fromJson({
      job_name: BULL_JOB_NAME.CRAWL_CONTRACT_EVENT,
      height: this.blockHeight - 1,
    }),
    BlockCheckpoint.fromJson({
      job_name: BULL_JOB_NAME.CRAWL_SMART_CONTRACT,
      height: this.blockHeight,
    }),
  ];

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

  untrackContract = {
    ...CW721Contract.fromJson({
      contract_id: 3,
      symbol: 'symbol',
      minter: 'minter',
      name: '',
    }),
    smart_contract: {
      name: 'UntrackContract',
      address: 'untrack_contract',
      creator: 'phamphong_creator',
      code_id: 100,
      instantiate_hash: 'abc',
      instantiate_height: 300000,
    },
  };

  cw721HandlerService = this.broker.createService(
    Cw721HandlerService
  ) as Cw721HandlerService;

  crawlContractEventService = this.broker.createService(
    CrawlContractEventService
  ) as CrawlContractEventService;

  block: Block = Block.fromJson({
    height: this.blockHeight,
    hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9F',
    time: '2023-01-12T01:53:57.216Z',
    proposer_address: 'auraomd;cvpio3j4eg',
    data: {},
  });

  txInsert = {
    ...Transaction.fromJson({
      height: this.blockHeight,
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
          contract: this.mockInitContract_2.smart_contract.address,
        },
        events: [
          {
            type: 'execute',
            block_height: this.blockHeight,
            source: 'TX_EVENT',
            attributes: [
              {
                index: 0,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value: this.mockInitContract_2.smart_contract.address,
              },
              {
                index: 1,
                block_height: this.blockHeight,
                // tx_id: 1,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value: this.mockInitContract.smart_contract.address,
              },
            ],
          },
          {
            block_height: this.blockHeight,
            source: 'TX_EVENT',
            type: 'instantiate',
            attributes: [
              {
                index: 0,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value: this.mockInitContract.smart_contract.address,
              },
              {
                index: 1,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: 'code_id',
                value: '6',
              },
            ],
          },
          {
            block_height: this.blockHeight,
            source: 'TX_EVENT',
            type: 'instantiate',
            attributes: [
              {
                index: 2,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value: this.mockInitContract.smart_contract.address,
              },
              {
                index: 3,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: 'code_id',
                value: '2',
              },
            ],
          },
          {
            block_height: this.blockHeight,
            source: 'TX_EVENT',
            type: 'wasm',
            attributes: [
              {
                index: 0,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value: this.mockInitContract_2.smart_contract.address,
              },
              {
                index: 1,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: 'action',
                value: 'phamphong_action',
              },
            ],
          },
          {
            block_height: this.blockHeight,
            source: 'TX_EVENT',
            type: 'wasm',
            attributes: [
              {
                index: 2,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value: this.mockInitContract_2.smart_contract.address,
              },
              {
                index: 3,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: 'action',
                value: 'add_mint_phase',
              },
              {
                index: 4,
                block_height: this.blockHeight,
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
          contract: this.mockInitContract.smart_contract.address,
        },
        events: [
          {
            block_height: this.blockHeight,
            source: 'TX_EVENT',
            type: 'execute',
            attributes: [
              {
                index: 0,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value: this.mockInitContract.smart_contract.address,
              },
            ],
          },
          {
            block_height: this.blockHeight,
            source: 'TX_EVENT',
            type: 'wasm',
            attributes: [
              {
                index: 0,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value: this.mockInitContract.smart_contract.address,
              },
              {
                index: 1,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: 'action',
                value: 'add_whitelist',
              },
              {
                index: 2,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: 'token_id',
                value: 'test2',
              },
            ],
          },
          {
            block_height: this.blockHeight,
            source: 'TX_EVENT',
            type: 'wasm',
            attributes: [
              {
                index: 3,
                block_height: this.blockHeight,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value: this.mockInitContract.smart_contract.address,
              },
              {
                index: 4,
                block_height: this.blockHeight,
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
  };

  @BeforeAll()
  async initSuite() {
    await this.cw721HandlerService.getQueueManager().stopAll();
    await this.crawlContractEventService.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE smart_contract_event, smart_contract_event_attribute, smart_contract, code, event_attribute, transaction_message, event, transaction, block, block_checkpoint, cw721_token, cw721_contract, cw721_activity, code RESTART IDENTITY CASCADE'
    );
    await BlockCheckpoint.query().insert(this.mockBlockCheckpoint);
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
    await Code.query().insertGraph(this.codeId);
    await CW721Contract.query().insertGraph(this.mockInitContract);
    await CW721Contract.query().insertGraph(this.mockInitContract_2);
    await CW721Contract.query().insertGraph(this.untrackContract);
    await this.crawlContractEventService.jobHandler();
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @AfterEach()
  async afterEach() {
    jest.resetAllMocks();
  }

  @Test('test getContractActivities function')
  public async testGetContractActivities() {
    const extractData = await getContractActivities(
      this.block.height - 1,
      this.block.height
    );
    expect(
      extractData.map((data) => ({
        action: data.action,
        contractAddress: data.contractAddress,
        attributes: data.attributes,
      }))
    ).toEqual([
      {
        action: 'instantiate',
        contractAddress:
          this.txInsert.messages[0].events[1].attributes[0].value,
        attributes: [
          this.txInsert.messages[0].events[1].attributes[0],
          this.txInsert.messages[0].events[1].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: 'instantiate',
        contractAddress:
          this.txInsert.messages[0].events[2].attributes[0].value,
        attributes: [
          this.txInsert.messages[0].events[2].attributes[0],
          this.txInsert.messages[0].events[2].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: this.txInsert.messages[0].events[3].attributes[1].value,
        contractAddress:
          this.txInsert.messages[0].events[3].attributes[0].value,
        attributes: [
          this.txInsert.messages[0].events[3].attributes[0],
          this.txInsert.messages[0].events[3].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: this.txInsert.messages[0].events[4].attributes[1].value,
        contractAddress:
          this.txInsert.messages[0].events[4].attributes[0].value,
        attributes: [
          this.txInsert.messages[0].events[4].attributes[0],
          this.txInsert.messages[0].events[4].attributes[1],
          this.txInsert.messages[0].events[4].attributes[2],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: this.txInsert.messages[1].events[1].attributes[1].value,
        contractAddress:
          this.txInsert.messages[1].events[1].attributes[0].value,
        attributes: [
          this.txInsert.messages[1].events[1].attributes[0],
          this.txInsert.messages[1].events[1].attributes[1],
          this.txInsert.messages[1].events[1].attributes[2],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: undefined,
        contractAddress:
          this.txInsert.messages[1].events[2].attributes[0].value,
        attributes: [
          this.txInsert.messages[1].events[2].attributes[0],
          this.txInsert.messages[1].events[2].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
    ]);
  }

  @Test('test getCw721ContractEvent function')
  public async testGetCw721ContractEvent() {
    const extractData = await CW721Activity.getCw721ContractEvents(
      this.block.height - 1,
      this.block.height
    );
    expect(
      extractData.map((data) => ({
        action: data.action,
        contractAddress: data.contractAddress,
        attributes: data.attributes,
        hash: data.hash,
        height: data.height,
        smart_contract_event_id: data.smart_contract_event_id,
      }))
    ).toEqual([
      {
        action: 'instantiate',
        contractAddress:
          this.txInsert.messages[0].events[1].attributes[0].value,
        attributes: [
          this.txInsert.messages[0].events[1].attributes[0],
          this.txInsert.messages[0].events[1].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
        hash: this.txInsert.hash,
        height: this.txInsert.height,
        smart_contract_event_id: expect.anything(),
      },
      {
        action: 'instantiate',
        contractAddress:
          this.txInsert.messages[0].events[2].attributes[0].value,
        attributes: [
          this.txInsert.messages[0].events[2].attributes[0],
          this.txInsert.messages[0].events[2].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
        hash: this.txInsert.hash,
        height: this.txInsert.height,
        smart_contract_event_id: expect.anything(),
      },
      {
        action: this.txInsert.messages[0].events[3].attributes[1].value,
        contractAddress:
          this.txInsert.messages[0].events[3].attributes[0].value,
        attributes: [
          this.txInsert.messages[0].events[3].attributes[0],
          this.txInsert.messages[0].events[3].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
        hash: this.txInsert.hash,
        height: this.txInsert.height,
        smart_contract_event_id: expect.anything(),
      },
      {
        action: this.txInsert.messages[0].events[4].attributes[1].value,
        contractAddress:
          this.txInsert.messages[0].events[4].attributes[0].value,
        attributes: [
          this.txInsert.messages[0].events[4].attributes[0],
          this.txInsert.messages[0].events[4].attributes[1],
          this.txInsert.messages[0].events[4].attributes[2],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
        hash: this.txInsert.hash,
        height: this.txInsert.height,
        smart_contract_event_id: expect.anything(),
      },
      {
        action: this.txInsert.messages[1].events[1].attributes[1].value,
        contractAddress:
          this.txInsert.messages[1].events[1].attributes[0].value,
        attributes: [
          this.txInsert.messages[1].events[1].attributes[0],
          this.txInsert.messages[1].events[1].attributes[1],
          this.txInsert.messages[1].events[1].attributes[2],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
        hash: this.txInsert.hash,
        height: this.txInsert.height,
        smart_contract_event_id: expect.anything(),
      },
      {
        action: null,
        contractAddress:
          this.txInsert.messages[1].events[2].attributes[0].value,
        attributes: [
          this.txInsert.messages[1].events[2].attributes[0],
          this.txInsert.messages[1].events[2].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
        hash: this.txInsert.hash,
        height: this.txInsert.height,
        smart_contract_event_id: expect.anything(),
      },
    ]);
  }

  @Test('test getCw721ContractEvent by contract function')
  public async testGetCw721ContractEventByContract() {
    const extractData = await CW721Activity.getCw721ContractEvents(
      this.block.height - 1,
      this.block.height,
      1
    );
    expect(
      extractData.map((data) => ({
        action: data.action,
        contractAddress: data.contractAddress,
        attributes: data.attributes,
        hash: data.hash,
        height: data.height,
      }))
    ).toEqual([
      {
        action: 'instantiate',
        contractAddress:
          this.txInsert.messages[0].events[1].attributes[0].value,
        attributes: [
          this.txInsert.messages[0].events[1].attributes[0],
          this.txInsert.messages[0].events[1].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
        hash: this.txInsert.hash,
        height: this.txInsert.height,
      },
      {
        action: 'instantiate',
        contractAddress:
          this.txInsert.messages[0].events[2].attributes[0].value,
        attributes: [
          this.txInsert.messages[0].events[2].attributes[0],
          this.txInsert.messages[0].events[2].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
        hash: this.txInsert.hash,
        height: this.txInsert.height,
      },
      {
        action: this.txInsert.messages[1].events[1].attributes[1].value,
        contractAddress:
          this.txInsert.messages[1].events[1].attributes[0].value,
        attributes: [
          this.txInsert.messages[1].events[1].attributes[0],
          this.txInsert.messages[1].events[1].attributes[1],
          this.txInsert.messages[1].events[1].attributes[2],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
        hash: this.txInsert.hash,
        height: this.txInsert.height,
      },
      {
        action: null,
        contractAddress:
          this.txInsert.messages[1].events[2].attributes[0].value,
        attributes: [
          this.txInsert.messages[1].events[2].attributes[0],
          this.txInsert.messages[1].events[2].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
        hash: this.txInsert.hash,
        height: this.txInsert.height,
      },
    ]);

    const extractData1 = await CW721Activity.getCw721ContractEvents(
      this.block.height - 1,
      this.block.height,
      1,
      {
        limit: 2,
        prevId: 0,
      }
    );

    expect(
      extractData1.map((data) => ({
        action: data.action,
        contractAddress: data.contractAddress,
        attributes: data.attributes,
        hash: data.hash,
        height: data.height,
      }))
    ).toEqual([
      {
        action: 'instantiate',
        contractAddress:
          this.txInsert.messages[0].events[1].attributes[0].value,
        attributes: [
          this.txInsert.messages[0].events[1].attributes[0],
          this.txInsert.messages[0].events[1].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
        hash: this.txInsert.hash,
        height: this.txInsert.height,
      },
      {
        action: 'instantiate',
        contractAddress:
          this.txInsert.messages[0].events[2].attributes[0].value,
        attributes: [
          this.txInsert.messages[0].events[2].attributes[0],
          this.txInsert.messages[0].events[2].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
        hash: this.txInsert.hash,
        height: this.txInsert.height,
      },
    ]);
  }

  @Test('test HandlerCw721Transfer')
  public async testHandlerCw721Transfer() {
    const [recipient, sender] = ['phamphong_transfer', 'bhdgsdfgtsdtfsdfs'];
    const mockContractTransferMsg = SmartContractEvent.fromJson({
      contractAddress: this.mockInitContract.smart_contract.address,
      action: 'transfer_nft',
      content: '',
      attributes: [
        {
          smart_contract_event_id: '100',
          key: '_contract_address',
          value: this.mockInitContract.smart_contract.address,
        },
        {
          smart_contract_event_id: '100',
          key: 'action',
          value: 'transfer_nft',
        },
        {
          smart_contract_event_id: '100',
          key: 'recipient',
          value: recipient,
        },
        {
          smart_contract_event_id: '100',
          key: 'sender',
          value: sender,
        },
        {
          smart_contract_event_id: '100',
          key: 'token_id',
          value: this.mockInitContract.tokens[0].token_id,
        },
      ],
      height: 100000,
      hash: '',
      event_id: '10',
    });
    const tokens = _.keyBy(
      await CW721Token.query().withGraphFetched('contract.smart_contract'),
      (o) => `${o.contract.smart_contract.address}_${o.token_id}`
    );
    const cw721Activities: CW721Activity[] = [];
    await knex.transaction(async (trx) => {
      const trackedCw721ContractsByAddr = _.keyBy(
        await CW721Contract.getCw721TrackedContracts(
          [mockContractTransferMsg.contractAddress],
          trx
        ),
        'address'
      );
      const cw721Handler = new Cw721Handler(
        tokens,
        cw721Activities,
        trackedCw721ContractsByAddr,
        [mockContractTransferMsg]
      );
      cw721Handler.process();
      const token =
        cw721Handler.tokensKeyBy[
          `${mockContractTransferMsg.contractAddress}_${getAttributeFrom(
            mockContractTransferMsg.attributes,
            EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
          )}`
        ];
      expect(token.owner).toEqual(recipient);
      expect(token.last_updated_height).toEqual(mockContractTransferMsg.height);
      this.testActivity(cw721Handler.cw721Activities[0], {
        sender,
        from: this.mockInitContract.tokens[0].owner,
        to: recipient,
        height: mockContractTransferMsg.height,
        tx_hash: mockContractTransferMsg.hash,
        action: mockContractTransferMsg.action,
        cw721_contract_id: token.cw721_contract_id,
        token_id: token.token_id,
      });
    });
  }

  @Test('test HandlerCw721Mint')
  public async testHandlerCw721Mint() {
    const [minter, owner, tokenId] = [
      'aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx',
      'phamphong_test_mint',
      'bumo',
    ];
    const msg = SmartContractEvent.fromJson({
      contractAddress: this.mockInitContract.smart_contract.address,
      action: 'mint',
      content:
        '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
      attributes: [
        {
          smart_contract_event_id: '100',
          key: '_contract_address',
          value: this.mockInitContract.smart_contract.address,
        },
        {
          smart_contract_event_id: '100',
          key: 'action',
          value: 'mint',
        },
        {
          smart_contract_event_id: '100',
          key: 'minter',
          value: minter,
        },
        {
          smart_contract_event_id: '100',
          key: 'owner',
          value: owner,
        },
        {
          smart_contract_event_id: '100',
          key: 'token_id',
          value: tokenId,
        },
      ],
      height: 100000,
      hash: '',
      event_id: 10,
    });
    const tokens = _.keyBy(
      await CW721Token.query().withGraphFetched('contract.smart_contract'),
      (o) => `${o.contract.smart_contract.address}_${o.token_id}`
    );
    const cw721Activities: CW721Activity[] = [];
    await knex.transaction(async (trx) => {
      const trackedCw721ContractsByAddr = _.keyBy(
        await CW721Contract.getCw721TrackedContracts(
          [msg.contractAddress],
          trx
        ),
        'address'
      );
      const cw721Handler = new Cw721Handler(
        tokens,
        cw721Activities,
        trackedCw721ContractsByAddr,
        [msg]
      );
      cw721Handler.process();
      const token =
        cw721Handler.tokensKeyBy[
          `${msg.contractAddress}_${getAttributeFrom(
            msg.attributes,
            EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
          )}`
        ];
      expect(token.owner).toEqual(owner);
      expect(token.token_id).toEqual(tokenId);
      expect(token.last_updated_height).toEqual(msg.height);
      this.testActivity(cw721Handler.cw721Activities[0], {
        sender: minter,
        from: null,
        to: owner,
        height: msg.height,
        tx_hash: msg.hash,
        action: msg.action,
        cw721_contract_id: token.cw721_contract_id,
        token_id: token.token_id,
      });
    });
  }

  @Test('test HandlerCw721Burn')
  public async testHandlerCw721Burn() {
    const [sender, tokenId] = [
      'aura15f6wn3nymdnhnh5ddlqletuptjag09tryrtpq5',
      this.mockInitContract.tokens[0].token_id,
    ];
    const msg = SmartContractEvent.fromJson({
      contractAddress: this.mockInitContract.smart_contract.address,
      action: 'burn',
      content: '',
      attributes: [
        {
          smart_contract_event_id: '100',
          key: '_contract_address',
          value: this.mockInitContract.smart_contract.address,
        },
        {
          smart_contract_event_id: '100',
          key: 'action',
          value: 'burn',
        },
        {
          smart_contract_event_id: '100',
          key: 'sender',
          value: sender,
        },
        {
          smart_contract_event_id: '100',
          key: 'token_id',
          value: tokenId,
        },
      ],
      height: 500000,
      hash: '',
      event_id: 10,
    });
    const tokens = _.keyBy(
      await CW721Token.query().withGraphFetched('contract.smart_contract'),
      (o) => `${o.contract.smart_contract.address}_${o.token_id}`
    );
    const cw721Activities: CW721Activity[] = [];
    await knex.transaction(async (trx) => {
      const trackedCw721ContractsByAddr = _.keyBy(
        await CW721Contract.getCw721TrackedContracts(
          [msg.contractAddress],
          trx
        ),
        'address'
      );
      const cw721Handler = new Cw721Handler(
        tokens,
        cw721Activities,
        trackedCw721ContractsByAddr,
        [msg]
      );
      cw721Handler.process();
      const token =
        cw721Handler.tokensKeyBy[
          `${msg.contractAddress}_${getAttributeFrom(
            msg.attributes,
            EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
          )}`
        ];
      expect(token.owner).toEqual(this.mockInitContract.tokens[0].owner);
      expect(token.token_id).toEqual(tokenId);
      expect(token.last_updated_height).toEqual(msg.height);
      expect(token.burned).toEqual(true);
      this.testActivity(cw721Handler.cw721Activities[0], {
        sender,
        from: this.mockInitContract.tokens[0].owner,
        to: null,
        height: msg.height,
        tx_hash: msg.hash,
        action: msg.action,
        cw721_contract_id: token.cw721_contract_id,
        token_id: token.token_id,
      });
    });
  }

  @Test('test HandlerCw721Others')
  public async testHandlerCw721Others() {
    const [sender, tokenId] = [
      'aura15f6wn3nymdnhnh5ddlqletuptjag09tryrtpq5',
      this.mockInitContract.tokens[0].token_id,
    ];
    const msg = SmartContractEvent.fromJson({
      contractAddress: this.mockInitContract.smart_contract.address,
      action: 'abc',
      content: '',
      attributes: [
        {
          smart_contract_event_id: '100',
          key: '_contract_address',
          value: this.mockInitContract.smart_contract.address,
        },
        {
          smart_contract_event_id: '100',
          key: 'action',
          value: 'burn',
        },
        {
          smart_contract_event_id: '100',
          key: 'sender',
          value: sender,
        },
        {
          smart_contract_event_id: '100',
          key: 'token_id',
          value: tokenId,
        },
      ],
      height: 500000,
      hash: '',
      event_id: 10,
    });
    const tokens = _.keyBy(
      await CW721Token.query().withGraphFetched('contract.smart_contract'),
      (o) => `${o.contract.smart_contract.address}_${o.token_id}`
    );
    const cw721Activities: CW721Activity[] = [];
    await knex.transaction(async (trx) => {
      const trackedCw721ContractsByAddr = _.keyBy(
        await CW721Contract.getCw721TrackedContracts(
          [msg.contractAddress],
          trx
        ),
        'address'
      );
      const cw721Handler = new Cw721Handler(
        tokens,
        cw721Activities,
        trackedCw721ContractsByAddr,
        [msg]
      );
      cw721Handler.process();
      const token =
        cw721Handler.tokensKeyBy[
          `${msg.contractAddress}_${getAttributeFrom(
            msg.attributes,
            EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
          )}`
        ];
      expect(token.burned).toEqual(false);
      this.testActivity(cw721Handler.cw721Activities[0], {
        sender,
        from: undefined,
        to: undefined,
        height: msg.height,
        tx_hash: msg.hash,
        action: msg.action,
        cw721_contract_id: token.cw721_contract_id,
        token_id: token.token_id,
      });
    });
  }

  @Test('test Cw721 Re-Mint')
  public async testhandlerCw721ReMint() {
    const msgs = [
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'burn',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'burn',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'fgfgsfgsdrtwe',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: this.mockInitContract.tokens[0].token_id,
          },
        ],
        height: 5000,
        hash: '',
        event_id: 10,
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'mint',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
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
            value: this.mockInitContract.tokens[0].token_id,
          },
        ],
        height: 100000,
        hash: '',
        event_id: 100,
      }),
    ];
    const beforeTokens = _.keyBy(
      await CW721Token.query()
        .withGraphJoined('contract.smart_contract')
        .where('token_id', this.mockInitContract.tokens[0].token_id)
        .andWhere(
          'contract:smart_contract.address',
          this.mockInitContract.smart_contract.address
        ),
      (o) => `${o.contract.smart_contract.address}_${o.token_id}`
    );
    await knex.transaction(async (trx) => {
      const { tokens } = await this.cw721HandlerService.handleCw721MsgExec(
        msgs,
        trx
      );
      const token =
        beforeTokens[
          `${this.mockInitContract.smart_contract.address}_${this.mockInitContract.tokens[0].token_id}`
        ];
      const reMintedToken = tokens.find(
        (e) =>
          e.cw721_contract_id ===
            this.mockInitContract.tokens[0].cw721_contract_id &&
          e.token_id === msgs[1].attributes[4].value
      );
      expect(reMintedToken?.owner).toEqual(msgs[1].attributes[3].value);
      expect(reMintedToken?.id).toEqual(token.id);
      expect(reMintedToken?.media_info).toEqual(null);
      expect(reMintedToken?.burned).toEqual(false);
      await trx.rollback();
    });
  }

  @Test('test handleCw721MsgExec')
  public async testHandleCw721MsgExec() {
    const newTokenId = 'fgksdfjghkjsdfg';
    const msgs = [
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'transfer_nft',
          },
          {
            smart_contract_event_id: '100',
            key: 'recipient',
            value: 'fgsdfsdfsdafsdfsd',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'cxzvcxfgsdfs',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: this.mockInitContract.tokens[0].token_id,
          },
        ],
        height: 100000,
        hash: '',
        event_id: '10',
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'mint',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'mint',
          },
          {
            smart_contract_event_id: '100',
            key: 'minter',
            value: 'dsfsdjkgbfsdgbv',
          },
          {
            smart_contract_event_id: '100',
            key: 'owner',
            value: 'seqaeasdasdfa',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: newTokenId,
          },
        ],
        height: 100001,
        hash: '',
        event_id: 10,
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'burn',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'burn',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'dfsgsfgfsgsvcxc',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: this.mockInitContract.tokens[0].token_id,
          },
        ],
        height: 500001,
        hash: '',
        event_id: 10,
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'transfer_nft',
          },
          {
            smart_contract_event_id: '100',
            key: 'recipient',
            value: 'qeqeqqsdcsdf',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'afxaxcatgcvbsgsd',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: newTokenId,
          },
        ],
        height: 100002,
        hash: '',
        event_id: '10',
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'burn',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'burn',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'dsfsdjkfhkcjnvkjxcnvkjxcn',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: newTokenId,
          },
        ],
        height: 500002,
        hash: '',
        event_id: 10,
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'abc',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'burn',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'dsfsdfv cvxcvxcv',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: 'ppoiojjlklk',
          },
        ],
        height: 500003,
        hash: '',
        event_id: 10,
      }),
    ];
    await knex.transaction(async (trx) => {
      const { cw721Activities, tokens } =
        await this.cw721HandlerService.handleCw721MsgExec(msgs, trx);
      const token = tokens.find(
        (e) =>
          e.token_id === this.mockInitContract.tokens[0].token_id &&
          e.cw721_contract_id === 1
      );
      const newToken = tokens.find((e) => e.token_id === newTokenId);
      expect(cw721Activities.length).toEqual(msgs.length);
      this.testActivity(cw721Activities[0], {
        sender: getAttributeFrom(
          msgs[0].attributes,
          EventAttribute.ATTRIBUTE_KEY.SENDER
        ),
        from: this.mockInitContract.tokens[0].owner,
        to: getAttributeFrom(
          msgs[0].attributes,
          EventAttribute.ATTRIBUTE_KEY.RECIPIENT
        ),
        height: msgs[0].height,
        tx_hash: msgs[0].hash,
        action: msgs[0].action,
        cw721_contract_id: 1,
        token_id: token?.token_id,
      });
      this.testActivity(cw721Activities[1], {
        sender: getAttributeFrom(
          msgs[1].attributes,
          EventAttribute.ATTRIBUTE_KEY.MINTER
        ),
        from: null,
        to: getAttributeFrom(
          msgs[1].attributes,
          EventAttribute.ATTRIBUTE_KEY.OWNER
        ),
        height: msgs[1].height,
        tx_hash: msgs[1].hash,
        action: msgs[1].action,
        cw721_contract_id: 1,
        token_id: newToken?.token_id,
      });
      this.testActivity(cw721Activities[2], {
        sender: getAttributeFrom(
          msgs[2].attributes,
          EventAttribute.ATTRIBUTE_KEY.SENDER
        ),
        from: getAttributeFrom(
          msgs[0].attributes,
          EventAttribute.ATTRIBUTE_KEY.RECIPIENT
        ),
        to: null,
        height: msgs[2].height,
        tx_hash: msgs[2].hash,
        action: msgs[2].action,
        cw721_contract_id: 1,
        token_id: token?.token_id,
      });
      this.testActivity(cw721Activities[3], {
        sender: getAttributeFrom(
          msgs[3].attributes,
          EventAttribute.ATTRIBUTE_KEY.SENDER
        ),
        from: getAttributeFrom(
          msgs[1].attributes,
          EventAttribute.ATTRIBUTE_KEY.OWNER
        ),
        to: getAttributeFrom(
          msgs[3].attributes,
          EventAttribute.ATTRIBUTE_KEY.RECIPIENT
        ),
        height: msgs[3].height,
        tx_hash: msgs[3].hash,
        action: msgs[3].action,
        cw721_contract_id: 1,
        token_id: newToken?.token_id,
      });
      this.testActivity(cw721Activities[4], {
        sender: getAttributeFrom(
          msgs[4].attributes,
          EventAttribute.ATTRIBUTE_KEY.SENDER
        ),
        from: getAttributeFrom(
          msgs[3].attributes,
          EventAttribute.ATTRIBUTE_KEY.RECIPIENT
        ),
        to: null,
        height: msgs[4].height,
        tx_hash: msgs[4].hash,
        action: msgs[4].action,
        cw721_contract_id: 1,
        token_id: newToken?.token_id,
      });
      this.testActivity(cw721Activities[5], {
        sender: getAttributeFrom(
          msgs[5].attributes,
          EventAttribute.ATTRIBUTE_KEY.SENDER
        ),
        height: msgs[5].height,
        tx_hash: msgs[5].hash,
        action: msgs[5].action,
        cw721_contract_id: 1,
        token_id: getAttributeFrom(
          msgs[5].attributes,
          EventAttribute.ATTRIBUTE_KEY.TOKEN_ID
        ),
      });
      expect(token?.owner).toEqual(
        getAttributeFrom(
          msgs[0].attributes,
          EventAttribute.ATTRIBUTE_KEY.RECIPIENT
        )
      );
      expect(token?.burned).toEqual(true);
      expect(token?.last_updated_height).toEqual(msgs[2].height);
      expect(newToken?.owner).toEqual(
        getAttributeFrom(
          msgs[3].attributes,
          EventAttribute.ATTRIBUTE_KEY.RECIPIENT
        )
      );
      expect(newToken?.burned).toEqual(true);
      expect(newToken?.last_updated_height).toEqual(msgs[4].height);
      await trx.rollback();
    });
  }

  @Test('test handleInstantiateMsgs')
  public async testHandleInstantiateMsgs() {
    const newContractAddress = 'jkhdkfjhsdfkjgbjdkfk';
    const newContractName = 'hghdfvbsmnfgvbsdb';
    const contractsInfo = [
      {
        address: newContractAddress,
        name: newContractName,
        symbol: 'symbol_1',
        minter: 'minter_1',
      },
    ];
    jest
      .spyOn(CW721Contract, 'getContractsInfo')
      .mockResolvedValue(contractsInfo);
    await knex.transaction(async (trx) => {
      await SmartContract.query()
        .transacting(trx)
        .insert(
          SmartContract.fromJson({
            name: newContractName,
            address: newContractAddress,
            creator: 'phamphong_creator',
            code_id: this.codeId.code_id,
            instantiate_hash: 'abc',
            instantiate_height: 300000,
          })
        );
      const msgs = [
        SmartContractEvent.fromJson({
          contractAddress: newContractAddress,
          sender: 'sfxzcvzxcfasd',
          action: 'instantiate',
          content: '',
          attributes: [],
          height: 1000000000,
          hash: 'fgfdgdfvbxcvxc',
          code_id: this.codeId.code_id,
          event_id: 100,
        }),
      ];
      await this.cw721HandlerService.handleInstantiateMsgs(msgs, trx);
      const contract = await CW721Contract.query()
        .transacting(trx)
        .alias('cw721_contract')
        .withGraphJoined('smart_contract')
        .where('smart_contract.address', newContractAddress)
        .select(
          'smart_contract.name as name',
          'cw721_contract.minter as minter',
          'cw721_contract.symbol as symbol'
        )
        .first();
      expect(contract?.minter).toEqual(contractsInfo[0].minter);
      expect(contract?.symbol).toEqual(contractsInfo[0].symbol);
      expect(contract?.name).toEqual(contractsInfo[0].name);
      await trx.rollback();
    });
  }

  @Test('test getCw721TrackedContracts')
  public async testgetCw721TrackedContracts() {
    await knex.transaction(async (trx) => {
      const results = await CW721Contract.getCw721TrackedContracts(
        [
          this.mockInitContract.smart_contract.address,
          this.untrackContract.smart_contract.address,
        ],
        trx
      );
      expect(results[0].address).toEqual(
        this.mockInitContract.smart_contract.address
      );
      expect(results[0].id).toEqual(1);
    });
  }

  @Test('test handle multi contract events')
  async testHandleMultiContractEvents() {
    await knex.transaction(async (trx) => {
      const token = await CW721Token.query()
        .transacting(trx)
        .insert(
          CW721Token.fromJson({
            token_id: 'token_multi',
            media_info: null,
            owner: 'owner1',
            cw721_contract_id: 1,
            last_updated_height: 1000,
          })
        );
      const lastOwner = 'recipient_4';
      const expectHeight = 2000000;
      const transferMsgs = [
        SmartContractEvent.fromJson({
          contractAddress: this.mockInitContract.smart_contract.address,
          action: 'transfer_nft',
          content: '',
          attributes: [
            {
              smart_contract_event_id: '100',
              key: '_contract_address',
              value: this.mockInitContract.smart_contract.address,
            },
            {
              smart_contract_event_id: '100',
              key: 'action',
              value: 'transfer_nft',
            },
            {
              smart_contract_event_id: '100',
              key: 'recipient',
              value: 'recipient_11',
            },
            {
              smart_contract_event_id: '100',
              key: 'sender',
              value: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
            },
            {
              smart_contract_event_id: '100',
              key: 'token_id',
              value: token.token_id,
            },
          ],
          height: 100000,
          hash: '',
          event_id: 10,
        }),
        SmartContractEvent.fromJson({
          contractAddress: this.mockInitContract.smart_contract.address,
          action: 'transfer_nft',
          content: '',
          attributes: [
            {
              smart_contract_event_id: '100',
              key: '_contract_address',
              value: this.mockInitContract.smart_contract.address,
            },
            {
              smart_contract_event_id: '100',
              key: 'action',
              value: 'transfer_nft',
            },
            {
              smart_contract_event_id: '100',
              key: 'recipient',
              value: 'recipient_2',
            },
            {
              smart_contract_event_id: '100',
              key: 'sender',
              value: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
            },
            {
              smart_contract_event_id: '100',
              key: 'token_id',
              value: token.token_id,
            },
          ],
          height: expectHeight,
          hash: '',
          event_id: 100,
        }),
        SmartContractEvent.fromJson({
          contractAddress: this.mockInitContract.smart_contract.address,
          action: 'transfer_nft',
          content: '',
          attributes: [
            {
              smart_contract_event_id: '100',
              key: '_contract_address',
              value: this.mockInitContract.smart_contract.address,
            },
            {
              smart_contract_event_id: '100',
              key: 'action',
              value: 'transfer_nft',
            },
            {
              smart_contract_event_id: '100',
              key: 'recipient',
              value: 'recipient_3',
            },
            {
              smart_contract_event_id: '100',
              key: 'sender',
              value: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
            },
            {
              smart_contract_event_id: '100',
              key: 'token_id',
              value: token.token_id,
            },
          ],
          height: expectHeight,
          hash: '',
          event_id: 100,
        }),
        SmartContractEvent.fromJson({
          contractAddress: this.mockInitContract.smart_contract.address,
          action: 'transfer_nft',
          content: '',
          attributes: [
            {
              smart_contract_event_id: '100',
              key: '_contract_address',
              value: this.mockInitContract.smart_contract.address,
            },
            {
              smart_contract_event_id: '100',
              key: 'action',
              value: 'transfer_nft',
            },
            {
              smart_contract_event_id: '100',
              key: 'recipient',
              value: lastOwner,
            },
            {
              smart_contract_event_id: '100',
              key: 'sender',
              value: 'aura1xahhax60fakwfng0sdd6wcxd0eeu00r5w3s49h',
            },
            {
              smart_contract_event_id: '100',
              key: 'token_id',
              value: token.token_id,
            },
          ],
          height: expectHeight + 1,
          hash: '',
          event_id: 100,
        }),
      ];
      const { cw721Activities, tokens } =
        await this.cw721HandlerService.handleCw721MsgExec(transferMsgs, trx);
      const resultToken = tokens.find((e) => e.id === token.id);
      expect(resultToken?.owner).toEqual(lastOwner);
      expect(resultToken?.last_updated_height).toEqual(expectHeight + 1);
      expect(cw721Activities.length).toEqual(transferMsgs.length);
      await trx.rollback();
    });
  }

  @Test('test untrack contract')
  async testUntrackContract() {
    const tokenId = 'untrack_token';
    const untrackContract = await CW721Contract.query()
      .where({
        contract_id: this.untrackContract.contract_id,
      })
      .first()
      .throwIfNotFound();
    const msgs = [
      SmartContractEvent.fromJson({
        contractAddress: this.untrackContract.smart_contract.address,
        action: 'mint',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.untrackContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'mint',
          },
          {
            smart_contract_event_id: '100',
            key: 'minter',
            value: 'aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx',
          },
          {
            smart_contract_event_id: '100',
            key: 'owner',
            value: 'phamphong_',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: tokenId,
          },
        ],
        height: 200000,
        hash: '',
        event_id: 100,
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.untrackContract.smart_contract.address,
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.untrackContract.smart_contract.address,
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
            value: tokenId,
          },
        ],
        height: 100000,
        hash: '',
        event_id: 10,
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.untrackContract.smart_contract.address,
        action: 'burn',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.untrackContract.smart_contract.address,
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
            value: tokenId,
          },
        ],
        height: 500000,
        hash: '',
        event_id: 10,
      }),
    ];
    await knex.transaction(async (trx) => {
      const { cw721Activities, tokens } =
        await this.cw721HandlerService.handleCw721MsgExec(msgs, trx);
      const results = tokens.filter(
        (e) => e.cw721_contract_id === untrackContract.id
      );
      expect(results.length).toEqual(0);
      expect(cw721Activities.length).toEqual(0);
      await trx.rollback();
    });
  }

  @Test('test handleJob')
  public async testHandleJob() {
    const newTokenId = 'fgksdfjghkjsdfg';
    const spy = jest.spyOn(BlockCheckpoint, 'getCheckpoint');
    spy.mockResolvedValue([
      1,
      2,
      BlockCheckpoint.fromJson({
        job_name: 'dfdsfgsg',
        height: 100,
      }),
    ]);
    const msgs = [
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'transfer_nft',
          },
          {
            smart_contract_event_id: '100',
            key: 'recipient',
            value: 'fgsdfsdfsdafsdfsd',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'cxzvcxfgsdfs',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: this.mockInitContract.tokens[0].token_id,
          },
        ],
        height: 100000,
        hash: '',
        event_id: '10',
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'mint',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'mint',
          },
          {
            smart_contract_event_id: '100',
            key: 'minter',
            value: 'dsfsdjkgbfsdgbv',
          },
          {
            smart_contract_event_id: '100',
            key: 'owner',
            value: 'seqaeasdasdfa',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: newTokenId,
          },
        ],
        height: 100001,
        hash: '',
        event_id: 10,
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'burn',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'burn',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'dfsgsfgfsgsvcxc',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: this.mockInitContract.tokens[0].token_id,
          },
        ],
        height: 500001,
        hash: '',
        event_id: 10,
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'transfer_nft',
          },
          {
            smart_contract_event_id: '100',
            key: 'recipient',
            value: 'qeqeqqsdcsdf',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'afxaxcatgcvbsgsd',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: newTokenId,
          },
        ],
        height: 100002,
        hash: '',
        event_id: '10',
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'burn',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'burn',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'dsfsdjkfhkcjnvkjxcnvkjxcn',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: newTokenId,
          },
        ],
        height: 500002,
        hash: '',
        event_id: 10,
      }),
      SmartContractEvent.fromJson({
        contractAddress: this.mockInitContract.smart_contract.address,
        action: 'abc',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: this.mockInitContract.smart_contract.address,
          },
          {
            smart_contract_event_id: '100',
            key: 'action',
            value: 'burn',
          },
          {
            smart_contract_event_id: '100',
            key: 'sender',
            value: 'dsfsdfv cvxcvxcv',
          },
          {
            smart_contract_event_id: '100',
            key: 'token_id',
            value: 'ppoiojjlklk',
          },
        ],
        height: 500003,
        hash: '',
        event_id: 10,
      }),
    ];
    jest.spyOn(CW721Activity, 'getCw721ContractEvents').mockResolvedValue(msgs);
    await this.cw721HandlerService.handleJob();
    const cw721Activities = await CW721Activity.query().orderBy('id');
    const tokens = await CW721Token.query()
      .withGraphJoined('contract.smart_contract')
      .where('contract:smart_contract.address', msgs[0].contractAddress);
    const token = tokens.find(
      (e) => e.token_id === this.mockInitContract.tokens[0].token_id
    );
    const newToken = tokens.find((e) => e.token_id === newTokenId);
    expect(cw721Activities.length).toEqual(msgs.length);
    this.testActivity(cw721Activities[0], {
      sender: getAttributeFrom(
        msgs[0].attributes,
        EventAttribute.ATTRIBUTE_KEY.SENDER
      ),
      from: this.mockInitContract.tokens[0].owner,
      to: getAttributeFrom(
        msgs[0].attributes,
        EventAttribute.ATTRIBUTE_KEY.RECIPIENT
      ),
      height: msgs[0].height,
      tx_hash: msgs[0].hash,
      action: msgs[0].action,
      cw721_contract_id: 1,
      cw721_token_id: token?.id,
    });
    this.testActivity(cw721Activities[1], {
      sender: getAttributeFrom(
        msgs[1].attributes,
        EventAttribute.ATTRIBUTE_KEY.MINTER
      ),
      from: null,
      to: getAttributeFrom(
        msgs[1].attributes,
        EventAttribute.ATTRIBUTE_KEY.OWNER
      ),
      height: msgs[1].height,
      tx_hash: msgs[1].hash,
      action: msgs[1].action,
      cw721_contract_id: 1,
      cw721_token_id: newToken?.id,
    });
    this.testActivity(cw721Activities[2], {
      sender: getAttributeFrom(
        msgs[2].attributes,
        EventAttribute.ATTRIBUTE_KEY.SENDER
      ),
      from: getAttributeFrom(
        msgs[0].attributes,
        EventAttribute.ATTRIBUTE_KEY.RECIPIENT
      ),
      to: null,
      height: msgs[2].height,
      tx_hash: msgs[2].hash,
      action: msgs[2].action,
      cw721_contract_id: 1,
      cw721_token_id: token?.id,
    });
    this.testActivity(cw721Activities[3], {
      sender: getAttributeFrom(
        msgs[3].attributes,
        EventAttribute.ATTRIBUTE_KEY.SENDER
      ),
      from: getAttributeFrom(
        msgs[1].attributes,
        EventAttribute.ATTRIBUTE_KEY.OWNER
      ),
      to: getAttributeFrom(
        msgs[3].attributes,
        EventAttribute.ATTRIBUTE_KEY.RECIPIENT
      ),
      height: msgs[3].height,
      tx_hash: msgs[3].hash,
      action: msgs[3].action,
      cw721_contract_id: 1,
      cw721_token_id: newToken?.id,
    });
    this.testActivity(cw721Activities[4], {
      sender: getAttributeFrom(
        msgs[4].attributes,
        EventAttribute.ATTRIBUTE_KEY.SENDER
      ),
      from: getAttributeFrom(
        msgs[3].attributes,
        EventAttribute.ATTRIBUTE_KEY.RECIPIENT
      ),
      to: null,
      height: msgs[4].height,
      tx_hash: msgs[4].hash,
      action: msgs[4].action,
      cw721_contract_id: 1,
      cw721_token_id: newToken?.id,
    });
    this.testActivity(cw721Activities[5], {
      sender: getAttributeFrom(
        msgs[5].attributes,
        EventAttribute.ATTRIBUTE_KEY.SENDER
      ),
      height: msgs[5].height,
      tx_hash: msgs[5].hash,
      action: msgs[5].action,
      cw721_contract_id: 1,
      cw721_token_id: null,
      from: null,
      to: null,
    });
    expect(token?.owner).toEqual(
      getAttributeFrom(
        msgs[0].attributes,
        EventAttribute.ATTRIBUTE_KEY.RECIPIENT
      )
    );
    expect(token?.burned).toEqual(true);
    expect(token?.last_updated_height).toEqual(msgs[2].height);
    expect(newToken?.owner).toEqual(
      getAttributeFrom(
        msgs[3].attributes,
        EventAttribute.ATTRIBUTE_KEY.RECIPIENT
      )
    );
    expect(newToken?.burned).toEqual(true);
    expect(newToken?.last_updated_height).toEqual(msgs[4].height);
  }

  testActivity(cw721Activity: CW721Activity, actual: any) {
    expect(cw721Activity.sender).toEqual(actual.sender);
    expect(cw721Activity.from).toEqual(actual.from);
    expect(cw721Activity.to).toEqual(actual.to);
    expect(cw721Activity.height).toEqual(actual.height);
    expect(cw721Activity.tx_hash).toEqual(actual.tx_hash);
    expect(cw721Activity.action).toEqual(actual.action);
    expect(cw721Activity.cw721_contract_id).toEqual(actual.cw721_contract_id);
    expect(cw721Activity.token_id).toEqual(actual.token_id);
    expect(cw721Activity.cw721_token_id).toEqual(actual.cw721_token_id);
  }
}
