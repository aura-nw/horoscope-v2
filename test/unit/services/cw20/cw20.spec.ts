import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { BULL_JOB_NAME } from '../../../../src/common';
import knex from '../../../../src/common/utils/db_connection';
import {
  Block,
  Code,
  Cw20Contract,
  Cw20Event,
  Transaction,
} from '../../../../src/models';
import { SmartContractEvent } from '../../../../src/models/smart_contract_event';
import Cw20Service from '../../../../src/services/cw20/cw20.service';
import Cw20UpdateByContractService from '../../../../src/services/cw20/cw20_update_by_contract.service';

@Describe('Test cw20 service')
export default class Cw20 {
  broker = new ServiceBroker({ logger: false });

  cw20Service = this.broker.createService(Cw20Service) as Cw20Service;

  cw20UpdateByContractService = this.broker.createService(
    Cw20UpdateByContractService
  ) as Cw20UpdateByContractService;

  block: Block = Block.fromJson({
    height: 132464134,
    hash: '4801997745BDD354C8F11CE4A4137237194099E664CD8F83A5FBA9041C43FE9F',
    time: '2023-01-12T01:53:57.216Z',
    proposer_address: 'auraomd;cvpio3j4eg',
    data: {},
  });

  txInsert = {
    ...Transaction.fromJson({
      height: this.block.height,
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
        content: {},
        events: [
          {
            type: 'execute',
            block_height: this.block.height,
            source: 'TX_EVENT',
            attributes: [
              {
                index: 0,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value: 'this.mockInitContract_2.smart_contract.address',
              },
              {
                index: 1,
                // tx_id: 1,
                composite_key: 'execute._contract_address',
                key: '_contract_address',
                value: 'fdgdgdfgdfg',
              },
            ],
          },
        ],
      },
    ],
  };

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

  smartContractEvent = SmartContractEvent.fromJson({
    smart_contract_id: 1,
    action: 'huh',
    event_id: 1,
    index: 1,
  });

  @BeforeAll()
  async initSuite() {
    this.cw20Service.getQueueManager().stopAll();
    this.cw20UpdateByContractService.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE code, cw20_contract, block, transaction RESTART IDENTITY CASCADE'
    );
    await Block.query().insert(this.block);
    await Transaction.query().insertGraph(this.txInsert);
    await Code.query().insertGraph(this.codeId);
    await SmartContractEvent.query().insert(this.smartContractEvent);
  }

  @AfterAll()
  async tearDown() {
    await this.cw20UpdateByContractService
      .getQueueManager()
      .getQueue(BULL_JOB_NAME.CW20_UPDATE_BY_CONTRACT)
      .drain();
    await this.broker.stop();
  }

  @Test('test handleCw20Instantiate')
  public async testHandleCw20Instantiates() {
    const cw20Events = [
      {
        cw20_contract_id: 1,
        contract_address: this.codeId.contracts[0].address,
        smart_contract_id: 1,
      },
      {
        contract_address: this.codeId.contracts[1].address,
        smart_contract_id: 2,
      },
    ];
    const mockContractsInfo = [
      {
        address: this.codeId.contracts[0].address,
        symbol: 'hdghghfghf',
        minter: 'gdfgdfgdfgf',
        decimal: '15',
        marketing_info: {},
        name: 'hihbhgh',
        smart_contract_id: 1,
      },
      {
        address: this.codeId.contracts[1].address,
        minter: 'gdfgdfgdfgf',
        decimal: '15',
        smart_contract_id: 2,
      },
    ];
    const mockInstantiateBalances1 = [
      {
        address: 'holder_1',
        amount: '123134134434',
        event_height: 8000,
        contract_address: this.codeId.contracts[0].address,
      },
      {
        address: 'holder_2',
        amount: '20032204',
        event_height: 8500,
        contract_address: this.codeId.contracts[0].address,
      },
      {
        address: 'holder_3',
        amount: '1654534',
        event_height: 7000,
        contract_address: this.codeId.contracts[0].address,
      },
    ];
    const mockInstantiateBalances2 = [
      {
        address: 'holder_hic_1',
        amount: '2154213',
        event_height: 7000,
        contract_address: this.codeId.contracts[1].address,
      },
      {
        address: 'holder_hic_2',
        amount: '31245465465',
        event_height: 8000,
        contract_address: this.codeId.contracts[1].address,
      },
      {
        address: 'holder_hic_3',
        amount: '874676446',
        event_height: 4500,
        contract_address: this.codeId.contracts[1].address,
      },
      {
        address: 'holder_hic_4',
        amount: '754657135',
        event_height: 4500,
        contract_address: this.codeId.contracts[1].address,
      },
    ];
    await knex.transaction(async (trx) => {
      this.cw20Service.getContractsInfo = jest.fn(() =>
        Promise.resolve(mockContractsInfo)
      );
      this.cw20Service.getInstantiateBalances = jest.fn((address) => {
        if (address === this.codeId.contracts[0].address) {
          return Promise.resolve(mockInstantiateBalances1);
        }
        return Promise.resolve(mockInstantiateBalances2);
      });
      await this.cw20Service.handleCw20Instantiate(
        cw20Events.map((event) => SmartContractEvent.fromJson(event)),
        trx
      );
      const cw20Contract1 = await Cw20Contract.query()
        .transacting(trx)
        .withGraphJoined('[holders,smart_contract]')
        .where('smart_contract.address', this.codeId.contracts[0].address)
        .first()
        .throwIfNotFound();
      expect(cw20Contract1.track).toEqual(true);
      expect(cw20Contract1.last_updated_height).toEqual(
        Math.min(...mockInstantiateBalances1.map((e) => e.event_height))
      );
      expect(cw20Contract1.total_supply).toEqual(
        mockInstantiateBalances1.reduce(
          (acc: string, curr: { address: string; amount: string }) =>
            (BigInt(acc) + BigInt(curr.amount)).toString(),
          '0'
        )
      );
      expect(cw20Contract1.holders[0].amount).toEqual(
        mockInstantiateBalances1[0].amount
      );
      expect(cw20Contract1.name).toEqual(mockContractsInfo[0].name);
      const cw20Contract2 = await Cw20Contract.query()
        .transacting(trx)
        .withGraphJoined('[holders,smart_contract]')
        .where('smart_contract.address', this.codeId.contracts[1].address)
        .first()
        .throwIfNotFound();
      expect(cw20Contract2.track).toEqual(true);
      expect(cw20Contract2.last_updated_height).toEqual(
        Math.min(...mockInstantiateBalances2.map((e) => e.event_height))
      );
      expect(cw20Contract2.total_supply).toEqual(
        mockInstantiateBalances2.reduce(
          (acc: string, curr: { address: string; amount: string }) =>
            (BigInt(acc) + BigInt(curr.amount)).toString(),
          '0'
        )
      );
      expect(cw20Contract2.holders[2].amount).toEqual(
        mockInstantiateBalances2[2].amount
      );
      expect(cw20Contract2.name).toBeNull();
      await trx.rollback();
    });
  }

  @Test('test handleCw20Histories')
  public async testHandleCw20Histories() {
    const cw20Events = [
      {
        cw20_contract_id: 1,
        contract_address: this.codeId.contracts[0].address,
        smart_contract_id: 1,
        smart_contract_event_id: 1,
        height: 1530,
      },
      {
        contract_address: this.codeId.contracts[1].address,
        smart_contract_id: 2,
        smart_contract_event_id: 1,
        height: 1520,
      },
    ];
    const mockContractsInfo = [
      {
        address: this.codeId.contracts[0].address,
        symbol: 'hdghghfghf',
        minter: 'gdfgdfgdfgf',
        decimal: '15',
        marketing_info: {},
        name: 'hihbhgh',
        smart_contract_id: 1,
      },
      {
        address: this.codeId.contracts[1].address,
        minter: 'gdfgdfgdfgf',
        decimal: '15',
        smart_contract_id: 2,
      },
    ];
    await knex.transaction(async (trx) => {
      this.cw20Service.getContractsInfo = jest.fn(() =>
        Promise.resolve(mockContractsInfo)
      );
      this.cw20Service.getInstantiateBalances = jest.fn(() =>
        Promise.resolve([])
      );
      await this.cw20Service.handleCw20Instantiate(
        cw20Events.map((event) => SmartContractEvent.fromJson(event)),
        trx
      );
      await this.cw20Service.handleCw20Histories(
        cw20Events.map((event) => SmartContractEvent.fromJson(event)),
        1000,
        2000,
        trx
      );
      const cw20ContractEvent1 = await Cw20Event.query()
        .transacting(trx)
        .withGraphJoined('smart_contract')
        .where('smart_contract.address', this.codeId.contracts[0].address)
        .first()
        .throwIfNotFound();
      expect(cw20ContractEvent1.action).toBeNull();
      expect(cw20ContractEvent1.height).toEqual(cw20Events[0].height);
      await trx.rollback();
    });
  }
}
