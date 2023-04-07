import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import { Block, Transaction } from '../../../../src/models';
import AssetTxHandlerService from '../../../services/cw721/cw721.service';
import CW721AssetService from '../../../../src/services/cw721/cw721.service';

@Describe('Test asset_indexer service')
export default class AssetIndexerTest {
  broker = new ServiceBroker({ logger: false });

  assetTxHandlerService = this.broker.createService(
    AssetTxHandlerService
  ) as AssetTxHandlerService;

  cw721AssetService = this.broker.createService(
    CW721AssetService
  ) as CW721AssetService;

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
          msg: '{"add_mint_phase":{"phase_data":{"start_time":"1679976124941000000","end_time":"1679982024941000000","max_supply":2000,"max_nfts_per_address":20,"price":{"amount":"10","denom":"ueaura"},"is_public":false}}}',
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
    await knex.raw(
      'TRUNCATE TABLE transaction_event_attribute, transaction_message, transaction_event, transaction, block, block_checkpoint RESTART IDENTITY CASCADE'
    );
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Init Env correct')
  public async testInitEnv() {
    // Config.ASSET_START_TX_ID = null;
    // await this.assetTxHandlerService.initEnv();
    // expect(this.assetTxHandlerService._currentAssetHandlerTx).toEqual(1);
    // Config.ASSET_START_TX_ID = 100;
    // await this.assetTxHandlerService.initEnv();
    // expect(this.assetTxHandlerService._currentAssetHandlerTx).toEqual(1);
  }

  // @Test('list contract and its info in range txs correct')
  // public async testListContractsAndInfoSuccess() {
  //   const extractData = await this.assetTxHandlerService.listContractsAndInfo(
  //     1,
  //     2
  //   );
  //   expect(extractData).toEqual([
  //     {
  //       action: 'add_mint_phase',
  //       sender: this.txInsert.messages[0].sender,
  //       contractAddress:
  //         this.txInsert.data.tx_response.logs[0].events[0].attributes[0].value,
  //       txhash: this.txInsert.hash,
  //     },
  //     {
  //       action: 'add_mint_phase',
  //       sender: this.txInsert.messages[0].sender,
  //       contractAddress:
  //         this.txInsert.data.tx_response.logs[0].events[0].attributes[1].value,
  //       txhash: this.txInsert.hash,
  //     },
  //     {
  //       action: 'add_whitelist',
  //       sender: this.txInsert.messages[1].sender,
  //       contractAddress:
  //         this.txInsert.data.tx_response.logs[1].events[0].attributes[0].value,
  //       txhash: this.txInsert.hash,
  //     },
  //   ]);
  // }
}
