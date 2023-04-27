import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { DirectSecp256k1HdWallet, GeneratedType } from '@cosmjs/proto-signing';
import {
  SigningStargateClient,
  assertIsDeliverTxSuccess,
} from '@cosmjs/stargate';
import { cosmwasm } from '@aura-nw/aurajs';
import fs from 'fs';
import _ from 'lodash';
import { toUtf8 } from '@cosmjs/encoding';
import {
  BULL_JOB_NAME,
  IAuraJSClientFactory,
  getLcdClient,
} from '../../../../src/common';
import config from '../../../../config.json' assert { type: 'json' };
import network from '../../../../network.json' assert { type: 'json' };
import {
  defaultSendFee,
  defaultSigningClientOptions,
} from '../../../helper/constant';
import {
  Block,
  BlockCheckpoint,
  Code,
  SmartContract,
  Transaction,
} from '../../../../src/models';
import knex from '../../../../src/common/utils/db_connection';
import CrawlSmartContractService from '../../../../src/services/crawl-cosmwasm/crawl_smart_contract.service';

@Describe('Test crawl_smart_contract service')
export default class CrawlSmartContractTest {
  blockCheckpoint = BlockCheckpoint.fromJson({
    job_name: BULL_JOB_NAME.CRAWL_CODE,
    height: 3967531,
  });

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
      data: {},
    }),
    events: {
      tx_msg_index: 0,
      type: 'instantiate',
      attributes: {
        key: '_contract_address',
        value:
          'aura14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9swserkw',
      },
    },
  };

  code: Code = Code.fromJson({
    code_id: 1,
    creator: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
    data_hash:
      '4169b4ca795d68de7c112b23b3526c082f788cb3d374a286eb99cf29f5173392',
    instantiate_permission: {
      permission: '3',
      address: '',
      addresses: [],
    },
    type: null,
    status: null,
    store_hash:
      '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997D',
    store_height: 3967530,
  });

  private _lcdClient!: IAuraJSClientFactory;

  broker = new ServiceBroker({ logger: false });

  crawlSmartContractService?: CrawlSmartContractService;

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    this.crawlSmartContractService = this.broker.createService(
      CrawlSmartContractService
    ) as CrawlSmartContractService;
    await this.crawlSmartContractService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.CRAWL_SMART_CONTRACT)
      .empty();
    await Promise.all([
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE code RESTART IDENTITY CASCADE'),
      BlockCheckpoint.query().delete(true),
    ]);
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
    await BlockCheckpoint.query().insert(this.blockCheckpoint);
    await Code.query().insert(this.code);
  }

  @AfterAll()
  async tearDown() {
    await Promise.all([
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE code RESTART IDENTITY CASCADE'),
      BlockCheckpoint.query().delete(true),
    ]);
    await this.broker.stop();
  }

  @Test('Crawl smart contract success')
  public async testCrawlSmartContract() {
    this._lcdClient = await getLcdClient();

    const memo = 'test store code and instantiate smart contract';

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
      'symbol force gallery make bulk round subway violin worry mixture penalty kingdom boring survey tool fringe patrol sausage hard admit remember broken alien absorb',
      {
        prefix: 'aura',
      }
    );
    const client = await SigningStargateClient.connectWithSigner(
      network.find((net) => net.chainId === config.chainId)?.RPC[0] ?? '',
      wallet,
      defaultSigningClientOptions
    );
    client.registry.register(
      '/cosmwasm.wasm.v1.MsgStoreCode',
      cosmwasm.wasm.v1.MsgStoreCode as GeneratedType
    );
    client.registry.register(
      '/cosmwasm.wasm.v1.MsgInstantiateContract',
      cosmwasm.wasm.v1.MsgInstantiateContract as GeneratedType
    );

    const msgStoreCode = {
      typeUrl: '/cosmwasm.wasm.v1.MsgStoreCode',
      value: cosmwasm.wasm.v1.MsgStoreCode.fromPartial({
        sender: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
        wasmByteCode: new Uint8Array(
          fs.readFileSync('./test/unit/services/crawl-cosmwasm/cw20_base.wasm')
        ),
      }),
    };

    const result = await client.signAndBroadcast(
      'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      [msgStoreCode],
      defaultSendFee,
      memo
    );
    assertIsDeliverTxSuccess(result);

    const msgInstantiate = {
      typeUrl: '/cosmwasm.wasm.v1.MsgInstantiateContract',
      value: cosmwasm.wasm.v1.MsgInstantiateContract.fromPartial({
        sender: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
        admin: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
        codeId: 1,
        label: 'test contract',
        msg: toUtf8(
          '{"name":"Another Do Family Coin","decimals":6,"initial_balances":[{"address":"aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa","amount":"999999"}],"symbol":"DFN"}'
        ),
      }),
    };

    const resultInstantiate = await client.signAndBroadcast(
      'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      [msgInstantiate],
      defaultSendFee,
      memo
    );
    assertIsDeliverTxSuccess(resultInstantiate);
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => setTimeout(resolve, 10000));

    await this.crawlSmartContractService?.handleJob({});

    const smartContract = await SmartContract.query().first();

    expect(_.omit(smartContract, ['created_at', 'updated_at'])).toEqual({
      id: 1,
      name: 'crates.io:cw20-base',
      address:
        'aura14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9swserkw',
      creator: 'aura1qwexv7c6sm95lwhzn9027vyu2ccneaqa7c24zk',
      code_id: 1,
      instantiate_hash:
        '4A8B0DE950F563553A81360D4782F6EC451F6BEF7AC50E2459D1997FA168997D',
      instantiate_height: 3967530,
      version: '0.16.0',
    });
  }
}
