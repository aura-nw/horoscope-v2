import { BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import Transaction from '../../../../src/models/transaction';
import Block from '../../../../src/models/block';
import AssetTxHandlerService from '../../../../src/services/asset-indexer/asset-tx-handler.service';

@Describe('Test crawl_validator service')
export default class CrawlValidatorTest {
  broker = new ServiceBroker({ logger: false });

  assetTxHandlerService?: AssetTxHandlerService;

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
      type: 'wasm',
      attributes: [
        {
          key: '_contract_address',
          value:
            'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8xe8',
        },
        {
          key: 'action',
          value: 'instantiate_launchpad',
        },
        {
          key: 'collection_code_id',
          value: '620',
        },
        {
          key: '_contract_address',
          value:
            'aura1lgt3dmtr3ln5wfaydh6mxw524xd2su0hc0tvq750a95jk54jnwvqed8xe8',
        },
        {
          key: 'action',
          value: 'instantiate_collection',
        },
        {
          key: 'collection_address',
          value:
            'aura1qs2nj0eynygetcuy03jwhmulm3g40l5ttg6crw2wvxsv7ezwe2dqj034rg',
        },
      ],
    },
    messages: {
      index: 0,
      type: '/cosmwasm.wasm.v1.MsgInstantiateContract',
      sender: 'aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n',
      content: {
        msg: '{"random_seed":"","colection_code_id":620,"launchpad_fee":0,"launchpad_collector":"aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n","collection_info":{"creator":"aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n","name":"Launchpad reveal collection","symbol":"LRC-1","max_supply":5000,"uri_prefix":"ipfs://bafybeifm3xas2egfbwzo7cg5wiayw44sbvfn6h5am2bydp2zpnypl7g5tq/images/","uri_suffix":".json","royalty_percentage":5,"royalty_payment_address":"aura1uaflg8e46wwtvm0td8mkjeaa0d5s53c92dj85r","final_proof":"aaaaaaaaaaaaaaaaaa"}}',
        '@type': '/cosmwasm.wasm.v1.MsgInstantiateContract',
        admin: '',
        funds: [],
        label: 'instantiation contract',
        sender: 'aura1uh24g2lc8hvvkaaf7awz25lrh5fptthu2dhq0n',
        code_id: {
          low: 621,
          high: 0,
          unsigned: true,
        },
      },
    },
  };

  @BeforeAll()
  async initSuite() {
    this.broker.start();
    this.assetTxHandlerService = this.broker.createService(
      AssetTxHandlerService
    ) as AssetTxHandlerService;
    await knex('transaction_event_attribute').del();
    await knex('transaction_message').del();
    await knex('transaction_event').del();
    await knex('transaction').del();
    await knex('block').del();
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
  }

  //   @AfterAll()
  //   async tearDown() {}

  @Test('CW721 tx forward success')
  public async testForwardCW721Success() {
    const listContractInputsAndOutputs =
      await this.assetTxHandlerService?.getContractsInputsAndOutputs(1, 10);
    expect(listContractInputsAndOutputs?.length).toEqual(1);
  }
}
