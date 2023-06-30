import { BULL_JOB_NAME } from '../../../../src/common';
import {
  Block,
  BlockCheckpoint,
  Code,
  Transaction,
} from '../../../../src/models';
import CW721Contract from '../../../../src/models/cw721_contract';

export const blockHeight = 3967530;
export const block: Block = Block.fromJson({
  height: blockHeight,
  hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9F',
  time: '2023-01-12T01:53:57.216Z',
  proposer_address: 'auraomd;cvpio3j4eg',
  data: {},
});
export const mockBlockCheckpoint = [
  BlockCheckpoint.fromJson({
    job_name: BULL_JOB_NAME.CRAWL_CONTRACT_EVENT,
    height: blockHeight,
  }),
  BlockCheckpoint.fromJson({
    job_name: BULL_JOB_NAME.CRAWL_SMART_CONTRACT,
    height: blockHeight,
  }),
];
export const codeId = {
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

export const untrackContract = {
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
export const mockInitContract = {
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
// eslint-disable-next-line @typescript-eslint/naming-convention
export const mockInitContract_2 = {
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
export const tx = {
  ...Transaction.fromJson({
    height: blockHeight,
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
        contract: mockInitContract_2.smart_contract.address,
      },
      events: [
        {
          type: 'execute',
          block_height: blockHeight,
          source: 'TX_EVENT',
          attributes: [
            {
              index: 0,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: '_contract_address',
              value: mockInitContract_2.smart_contract.address,
            },
            {
              index: 1,
              block_height: blockHeight,
              // tx_id: 1,
              composite_key: 'execute._contract_address',
              key: '_contract_address',
              value: mockInitContract.smart_contract.address,
            },
          ],
        },
        {
          block_height: blockHeight,
          source: 'TX_EVENT',
          type: 'instantiate',
          attributes: [
            {
              index: 0,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: '_contract_address',
              value: mockInitContract.smart_contract.address,
            },
            {
              index: 1,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: 'code_id',
              value: '6',
            },
          ],
        },
        {
          block_height: blockHeight,
          source: 'TX_EVENT',
          type: 'instantiate',
          attributes: [
            {
              index: 2,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: '_contract_address',
              value: mockInitContract.smart_contract.address,
            },
            {
              index: 3,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: 'code_id',
              value: '2',
            },
          ],
        },
        {
          block_height: blockHeight,
          source: 'TX_EVENT',
          type: 'wasm',
          attributes: [
            {
              index: 0,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: '_contract_address',
              value: mockInitContract_2.smart_contract.address,
            },
            {
              index: 1,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: 'action',
              value: 'phamphong_action',
            },
          ],
        },
        {
          block_height: blockHeight,
          source: 'TX_EVENT',
          type: 'wasm',
          attributes: [
            {
              index: 2,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: '_contract_address',
              value: mockInitContract_2.smart_contract.address,
            },
            {
              index: 3,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: 'action',
              value: 'add_mint_phase',
            },
            {
              index: 4,
              block_height: blockHeight,
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
        contract: mockInitContract.smart_contract.address,
      },
      events: [
        {
          block_height: blockHeight,
          source: 'TX_EVENT',
          type: 'execute',
          attributes: [
            {
              index: 0,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: '_contract_address',
              value: mockInitContract.smart_contract.address,
            },
          ],
        },
        {
          block_height: blockHeight,
          source: 'TX_EVENT',
          type: 'wasm',
          attributes: [
            {
              index: 0,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: '_contract_address',
              value: mockInitContract.smart_contract.address,
            },
            {
              index: 1,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: 'action',
              value: 'add_whitelist',
            },
            {
              index: 2,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: 'token_id',
              value: 'test2',
            },
          ],
        },
        {
          block_height: blockHeight,
          source: 'TX_EVENT',
          type: 'wasm',
          attributes: [
            {
              index: 3,
              block_height: blockHeight,
              composite_key: 'execute._contract_address',
              key: '_contract_address',
              value: mockInitContract.smart_contract.address,
            },
            {
              index: 4,
              block_height: blockHeight,
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
