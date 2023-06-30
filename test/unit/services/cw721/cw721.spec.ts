import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import { getContractActivities } from '../../../../src/common/utils/smart_contract';
import { Block, BlockCheckpoint, Transaction } from '../../../../src/models';
import { Code } from '../../../../src/models/code';
import CW721Contract from '../../../../src/models/cw721_contract';
import CW721Token from '../../../../src/models/cw721_token';
import CW721Activity from '../../../../src/models/cw721_tx';
import { SmartContractEvent } from '../../../../src/models/smart_contract_event';
import CrawlContractEventService from '../../../../src/services/crawl-cosmwasm/crawl_contract_event.service';
import Cw721HandlerService from '../../../../src/services/cw721/cw721.service';
import {
  mockInitContract_2,
  tx,
  block,
  mockInitContract,
  mockBlockCheckpoint,
  codeId,
  untrackContract,
} from './sample';

@Describe('Test cw721 service')
export default class AssetIndexerTest {
  broker = new ServiceBroker({ logger: false });

  cw721HandlerService = this.broker.createService(
    Cw721HandlerService
  ) as Cw721HandlerService;

  crawlContractEventService = this.broker.createService(
    CrawlContractEventService
  ) as CrawlContractEventService;

  @BeforeAll()
  async initSuite() {
    this.cw721HandlerService.getQueueManager().stopAll();
    this.crawlContractEventService.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE smart_contract_event, smart_contract_event_attribute, smart_contract, code, event_attribute, transaction_message, event, transaction, block, block_checkpoint, cw721_token, cw721_contract, cw721_activity, code RESTART IDENTITY CASCADE'
    );
    await BlockCheckpoint.query().insert(mockBlockCheckpoint);
    await Block.query().insert(block);
    await Transaction.query().insertGraph(tx);
    await Code.query().insertGraph(codeId);
    await CW721Contract.query().insertGraph(mockInitContract);
    await CW721Contract.query().insertGraph(mockInitContract_2);
    await CW721Contract.query().insertGraph(untrackContract);
    await this.crawlContractEventService.jobHandler();
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('test getContractActivities function')
  public async testGetContractActivities() {
    const extractData = await getContractActivities(
      block.height - 1,
      block.height
    );
    expect(
      extractData.map((data) => ({
        action: data.action,
        sender: data.sender,
        contractAddress: data.contractAddress,
        content: data.content,
        attributes: data.attributes,
      }))
    ).toEqual([
      {
        action: 'instantiate',
        sender: tx.messages[0].sender,
        contractAddress: tx.messages[0].events[1].attributes[0].value,
        content: tx.messages[0].content.msg,
        attributes: [
          tx.messages[0].events[1].attributes[0],
          tx.messages[0].events[1].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: 'instantiate',
        sender: tx.messages[0].sender,
        contractAddress: tx.messages[0].events[2].attributes[0].value,
        content: tx.messages[0].content.msg,
        attributes: [
          tx.messages[0].events[2].attributes[0],
          tx.messages[0].events[2].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: tx.messages[0].events[3].attributes[1].value,
        sender: tx.messages[0].sender,
        contractAddress: tx.messages[0].events[3].attributes[0].value,
        content: tx.messages[0].content.msg,
        attributes: [
          tx.messages[0].events[3].attributes[0],
          tx.messages[0].events[3].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: tx.messages[0].events[4].attributes[1].value,
        sender: tx.messages[0].sender,
        contractAddress: tx.messages[0].events[4].attributes[0].value,
        content: tx.messages[0].content.msg,
        attributes: [
          tx.messages[0].events[4].attributes[0],
          tx.messages[0].events[4].attributes[1],
          tx.messages[0].events[4].attributes[2],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: tx.messages[1].events[1].attributes[1].value,
        sender: tx.messages[1].sender,
        contractAddress: tx.messages[1].events[1].attributes[0].value,
        content: tx.messages[1].content.msg,
        attributes: [
          tx.messages[1].events[1].attributes[0],
          tx.messages[1].events[1].attributes[1],
          tx.messages[1].events[1].attributes[2],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
      {
        action: undefined,
        sender: tx.messages[1].sender,
        contractAddress: tx.messages[1].events[2].attributes[0].value,
        content: tx.messages[1].content.msg,
        attributes: [
          tx.messages[1].events[2].attributes[0],
          tx.messages[1].events[2].attributes[1],
        ].map((attribute) => ({ key: attribute.key, value: attribute.value })),
      },
    ]);
  }

  @Test('test jobHandlerCw721Transfer')
  public async testjobHandlerCw721Transfer() {
    const mockContractTransferMsg = [
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
            value: mockInitContract.tokens[0].token_id,
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
        event_id: '10',
      },
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
            value: mockInitContract.tokens[1].token_id,
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
        event_id: '100',
      },
    ];
    await this.cw721HandlerService.handlerCw721Transfer(
      mockContractTransferMsg.map((transferEvent) =>
        SmartContractEvent.fromJson({ ...transferEvent })
      )
    );
    const token1 = await CW721Token.query()
      .where('cw721_contract_id', 1)
      .andWhere('token_id', mockInitContract.tokens[0].token_id)
      .first();
    const token2 = await CW721Token.query()
      .where('cw721_contract_id', 1)
      .andWhere('token_id', mockInitContract.tokens[1].token_id)
      .first();
    expect(token1?.owner).toEqual(
      mockContractTransferMsg[0].attributes[2].value
    );
    expect(token2?.owner).toEqual(
      mockContractTransferMsg[1].attributes[2].value
    );
  }

  @Test('test jobHandlerCw721Mint')
  public async testjobHandlerCw721Mint() {
    const mockContractMintMsg = [
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
            value: 'phamphong_test_mint',
          },
          {
            smart_contract_event_id: '100',
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
        event_id: 10,
      },
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
            value: 'phamphong_test_mint2',
          },
          {
            smart_contract_event_id: '100',
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
        event_id: 100,
      },
    ];
    await this.cw721HandlerService.handlerCw721Mint(
      mockContractMintMsg.map((mintEvent) =>
        SmartContractEvent.fromJson({ ...mintEvent })
      )
    );
    const token1 = await CW721Token.query()
      .where('cw721_contract_id', mockInitContract.tokens[0].cw721_contract_id)
      .andWhere('token_id', mockContractMintMsg[0].attributes[4].value)
      .first();
    const token2 = await CW721Token.query()
      .where('cw721_contract_id', mockInitContract.tokens[1].cw721_contract_id)
      .andWhere('token_id', mockContractMintMsg[1].attributes[4].value)
      .first();
    expect(token1?.owner).toEqual(mockContractMintMsg[0].attributes[3].value);
    expect(token2?.owner).toEqual(mockContractMintMsg[1].attributes[3].value);
  }

  @Test('test jobHandlerCw721Burn')
  public async testjobHandlerCw721Burn() {
    const mockBurnMsg = [
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'burn',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
            value: mockInitContract.tokens[0].token_id,
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
        event_id: 10,
      },
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'burn',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
            value: mockInitContract.tokens[1].token_id,
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
        event_id: 100,
      },
    ];
    await this.cw721HandlerService.handlerCw721Burn(
      mockBurnMsg.map((burnEvent) =>
        SmartContractEvent.fromJson({ ...burnEvent })
      )
    );
    const token1 = await CW721Token.query()
      .where('cw721_contract_id', mockInitContract.tokens[0].cw721_contract_id)
      .andWhere('token_id', mockInitContract.tokens[0].token_id)
      .first();
    const token2 = await CW721Token.query()
      .where('cw721_contract_id', mockInitContract.tokens[0].cw721_contract_id)
      .andWhere('token_id', mockInitContract.tokens[1].token_id)
      .first();
    expect(token1?.burned).toEqual(true);
    expect(token2?.burned).toEqual(true);
  }

  @Test('test Cw721 Re-Mint')
  public async testhandlerCw721ReMint() {
    const mockContractMintMsg = [
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'mint',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
            value: mockInitContract.tokens[0].token_id,
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
        event_id: 100,
      },
    ];
    const burnedToken = await CW721Token.query()
      .where('cw721_contract_id', mockInitContract.tokens[0].cw721_contract_id)
      .andWhere('token_id', mockContractMintMsg[0].attributes[4].value)
      .first();
    expect(burnedToken?.burned).toEqual(true);
    expect(burnedToken?.media_info).toEqual(
      mockInitContract.tokens[0].media_info
    );
    await this.cw721HandlerService.handlerCw721Mint(
      mockContractMintMsg.map((event) =>
        SmartContractEvent.fromJson({ ...event })
      )
    );
    const reMintedToken = await CW721Token.query()
      .where('cw721_contract_id', mockInitContract.tokens[0].cw721_contract_id)
      .andWhere('token_id', mockContractMintMsg[0].attributes[4].value)
      .first();
    expect(reMintedToken?.owner).toEqual(
      mockContractMintMsg[0].attributes[3].value
    );
    expect(reMintedToken?.id).toEqual(burnedToken?.id);
    expect(reMintedToken?.media_info).toEqual(null);
    expect(reMintedToken?.burned).toEqual(false);
  }

  @Test('test handlerCw721Instantiate')
  public async testHandlerCw721Instantiate() {
    const mockContractsInfo = [
      {
        address: mockInitContract.smart_contract.address,
        name: mockInitContract.smart_contract.name,
        symbol: 'symbol_1',
        minter: 'minter_1',
      },
    ];
    CW721Contract.getContractsInfo = jest.fn(() =>
      Promise.resolve(mockContractsInfo)
    );
    const codeid: number = codeId.code_id;
    const mockInstantiateMsg = [
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'instantiate',
        content: '',
        attributes: [],
        tx: Transaction.fromJson({
          height: mockInitContract.smart_contract.instantiate_height,
          hash: mockInitContract.smart_contract.instantiate_hash,
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
        code_id: codeid,
        event_id: 100,
      },
    ];
    await this.cw721HandlerService.handleInstantiateMsgs(
      mockInstantiateMsg.map((event) =>
        SmartContractEvent.fromJson({ ...event })
      )
    );
    const contract = await CW721Contract.query()
      .alias('cw721_contract')
      .withGraphJoined('smart_contract')
      .where('cw721_contract.contract_id', mockInitContract.contract_id)
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
      cw721_contract_id: mockInitContract.tokens[0].cw721_contract_id,
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
        contractAddress: mockInitContract.smart_contract.address,
        onchainTokenId: 'token_id1',
        id: 1,
      },
      {
        contractAddress: mockInitContract.smart_contract.address,
        onchainTokenId: 'token_id2',
        id: 2,
      },
      {
        contractAddress: mockInitContract.smart_contract.address,
        onchainTokenId: 'bump',
        id: 5,
      },
      {
        contractAddress: mockInitContract.smart_contract.address,
        onchainTokenId: 'nunu',
        id: 6,
      },
      {
        contractAddress: mockInitContract.smart_contract.address,
        onchainTokenId: 'test conflict',
        id: 8,
      },
      {
        contractAddress: mockInitContract_2.smart_contract.address,
        onchainTokenId: 'token_id1',
        id: 3,
      },
      {
        contractAddress: mockInitContract_2.smart_contract.address,
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

  @Test('test getCw721TrackedContracts')
  public async testgetCw721TrackedContracts() {
    const results = await this.cw721HandlerService.getCw721TrackedContracts([
      mockInitContract.smart_contract.address,
      untrackContract.smart_contract.address,
    ]);
    expect(results[0].address).toEqual(mockInitContract.smart_contract.address);
    expect(results[0].id).toEqual(1);
  }

  @Test('test handle activity')
  public async testHandleActivity() {
    const mockActivityMsgs = [
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'mint',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
            value: mockInitContract.tokens[0].token_id,
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
        event_id: 100,
      },
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
        event_id: 10,
      },
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'burn',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
            value: mockInitContract.tokens[1].token_id,
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
        event_id: 100,
      },
    ];
    await this.cw721HandlerService.handleCW721Activity(
      mockActivityMsgs.map((burnEvent) =>
        SmartContractEvent.fromJson({ ...burnEvent })
      )
    );
    const cw721Activities = await CW721Activity.query();
    cw721Activities.forEach((cw721Activity, index) => {
      expect(cw721Activity.action).toEqual(mockActivityMsgs[index].action);
      expect(cw721Activity.cw721_contract_id).toEqual(
        mockInitContract.tokens[0].cw721_contract_id
      );
      expect(cw721Activity.tx_hash).toEqual(mockActivityMsgs[index].tx.hash);
    });
    expect(cw721Activities[0].cw721_token_id).toEqual(1);
    expect(cw721Activities[1].cw721_token_id).toEqual(0);
    expect(cw721Activities[2].cw721_token_id).toEqual(2);
  }

  @Test('test handle multi contract events')
  async testHandleMultiContractEvents() {
    const token = await CW721Token.query().insert(
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
    const mockTransferMsg = [
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
        event_id: 10,
      },
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
        tx: Transaction.fromJson({
          height: expectHeight,
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
        event_id: 100,
      },
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
        tx: Transaction.fromJson({
          height: expectHeight,
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
        event_id: 100,
      },
      {
        contractAddress: mockInitContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: mockInitContract.smart_contract.address,
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
        tx: Transaction.fromJson({
          height: expectHeight,
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
        event_id: 100,
      },
    ];
    await this.cw721HandlerService.handlerCw721Transfer(
      mockTransferMsg.map((transferMsg) =>
        SmartContractEvent.fromJson({ ...transferMsg })
      )
    );
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const resultToken = await CW721Token.query().where('id', token.id).first();
    expect(resultToken?.owner).toEqual(lastOwner);
    expect(resultToken?.last_updated_height).toEqual(expectHeight);
  }

  @Test('test untrack contract')
  async testUntrackContract() {
    const tokenId = 'untrack_token';
    const contract = await CW721Contract.query()
      .where({
        contract_id: untrackContract.contract_id,
      })
      .first()
      .throwIfNotFound();
    const mockContractExec = [
      {
        contractAddress: untrackContract.smart_contract.address,
        sender: '',
        action: 'mint',
        content:
          '{"mint": {"extension": {"image": "https://twilight.s3.ap-southeast-1.amazonaws.com/dev/p69ceVxdSNaslECBLbwN5gjHNYZSjQtb.png","name": "FEB24_1003","attributes": []},"owner": "aura1afuqcya9g59v0slx4e930gzytxvpx2c43xhvtx","token_id": "1677207819871"}}',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: untrackContract.smart_contract.address,
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
        event_id: 100,
      },
      {
        contractAddress: untrackContract.smart_contract.address,
        sender: '',
        action: 'transfer_nft',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: untrackContract.smart_contract.address,
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
        event_id: 10,
      },
      {
        contractAddress: untrackContract.smart_contract.address,
        sender: '',
        action: 'burn',
        content: '',
        attributes: [
          {
            smart_contract_event_id: '100',
            key: '_contract_address',
            value: untrackContract.smart_contract.address,
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
        event_id: 10,
      },
    ];
    await this.cw721HandlerService.handleCw721MsgExec(
      mockContractExec.map((execEvent) =>
        SmartContractEvent.fromJson({ ...execEvent })
      )
    );
    const tokens = await CW721Token.query().where({
      cw721_contract_id: contract.id,
    });
    expect(tokens.length).toEqual(0);
  }
}
