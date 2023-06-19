import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { CW20_ACTION } from '../../../../src/services/cw20/cw20.service';
import knex from '../../../../src/common/utils/db_connection';
import Cw20UpdateByContractService from '../../../../src/services/cw20/cw20_update_by_contract.service';
import { Code } from '../../../../src/models/code';
import { CW20Holder, Cw20Contract, Cw20Event } from '../../../../src/models';

@Describe('Test cw721 service')
export default class Cw20UpdateByContract {
  broker = new ServiceBroker({ logger: false });

  cw20UpdateByContractService = this.broker.createService(
    Cw20UpdateByContractService
  ) as Cw20UpdateByContractService;

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

  cw20Contract = [
    {
      ...Cw20Contract.fromJson({
        smart_contract_id: 1,
        marketing_info: {},
        total_supply: '1121112133',
        symbol: 'TEST SyMbol',
        minter: 'jfglkdfjgklfdgklklfdkl',
        name: 'dgbdfmnlkgsdfklgjksdfl',
        track: true,
        last_updated_height: 10000,
      }),
      holders: [
        {
          address: 'holder_1',
          amount: '123134134434',
          last_updated_height: 8000,
        },
        {
          address: 'holder_2',
          amount: '20032204',
          last_updated_height: 8500,
        },
      ],
    },
    {
      ...Cw20Contract.fromJson({
        smart_contract_id: 2,
        marketing_info: {},
        total_supply: '23434314',
        symbol: 'TEST SyMbol 2',
        minter: 'pham phong',
        name: 'hic',
        track: true,
        last_updated_height: 15022,
      }),
      holders: [
        {
          address: 'holder_hic_1',
          amount: '2154213',
          last_updated_height: 7000,
        },
        {
          address: 'holder_hic_2',
          amount: '31245465465',
          last_updated_height: 8000,
        },
        {
          address: 'holder_hic_3',
          amount: '874676446',
          last_updated_height: 1500,
        },
        {
          address: 'holder_hic_4',
          amount: '754657135',
          last_updated_height: 4500,
        },
      ],
    },
  ];

  @BeforeAll()
  async initSuite() {
    this.cw20UpdateByContractService.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE code, cw20_contract RESTART IDENTITY CASCADE'
    );
    await Code.query().insertGraph(this.codeId);
    await Cw20Contract.query().insertGraph(this.cw20Contract[0]);
    await Cw20Contract.query().insertGraph(this.cw20Contract[1]);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('test UpdateTotalSupply')
  public async testUpdateTotalSupply() {
    const contractIndex = 1;
    const endBlock = 8551411;
    const cw20Events = [
      {
        action: 'mint',
        amount: '23414154564',
        height: 1000,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
      },
      {
        action: 'burn',
        amount: '14423444',
        height: 1000,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
      },
      {
        action: 'mint',
        amount: '132434564654',
        height: 1000,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
      },
      {
        action: 'mint',
        amount: '11111111111111',
        height: 1000,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
      },
    ];
    await knex.transaction(async (trx) => {
      await this.cw20UpdateByContractService.updateTotalSupply(
        cw20Events.map((event) => Cw20Event.fromJson(event)),
        contractIndex,
        endBlock,
        trx
      );
      const contract = await Cw20Contract.query()
        .transacting(trx)
        .where('id', contractIndex)
        .first()
        .throwIfNotFound();
      expect(contract.total_supply).toEqual(
        (
          BigInt(this.cw20Contract[contractIndex - 1].total_supply) +
          BigInt(cw20Events[0].amount) -
          BigInt(cw20Events[1].amount) +
          BigInt(cw20Events[2].amount) +
          BigInt(cw20Events[3].amount)
        ).toString()
      );
      expect(contract.last_updated_height).toEqual(endBlock);
      await trx.rollback();
    });
  }

  @Test('test UpdateBalanceHolders')
  public async testUpdateBalanceHolders() {
    const contractIndex = 2;
    const cw20Events = [
      {
        action: CW20_ACTION.MINT,
        amount: '87465765466',
        height: 999,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
        to: this.cw20Contract[contractIndex - 1].holders[0].address,
      },
      {
        action: CW20_ACTION.BURN,
        amount: '4521443546',
        height: 992,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
        from: this.cw20Contract[contractIndex - 1].holders[1].address,
      },
      {
        action: CW20_ACTION.TRANSFER,
        amount: '4642443',
        height: 1102,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
        to: this.cw20Contract[contractIndex - 1].holders[1].address,
        from: this.cw20Contract[contractIndex - 1].holders[2].address,
      },
      {
        action: CW20_ACTION.TRANSFER,
        amount: '1122334456566',
        height: 1003,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
        to: this.cw20Contract[contractIndex - 1].holders[0].address,
        from: this.cw20Contract[contractIndex - 1].holders[1].address,
      },
      {
        action: CW20_ACTION.SEND,
        amount: '852123655',
        height: 1005,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
        to: this.cw20Contract[contractIndex - 1].holders[0].address,
        from: this.cw20Contract[contractIndex - 1].holders[1].address,
      },
      {
        action: CW20_ACTION.MINT,
        amount: '465462124654',
        height: 1000,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
        to: this.cw20Contract[contractIndex - 1].holders[2].address,
        from: this.cw20Contract[contractIndex - 1].holders[0].address,
      },
    ];
    await knex.transaction(async (trx) => {
      await this.cw20UpdateByContractService.updateBalanceHolders(
        cw20Events.map((event) => Cw20Event.fromJson(event)),
        contractIndex,
        trx
      );
      const holders = await CW20Holder.query()
        .transacting(trx)
        .where('cw20_contract_id', contractIndex)
        .throwIfNotFound();
      expect(
        holders.find(
          (e) =>
            e.address ===
            this.cw20Contract[contractIndex - 1].holders[0].address
        )?.amount
      ).toEqual(
        (
          BigInt(this.cw20Contract[contractIndex - 1].holders[0].amount) +
          BigInt(cw20Events[0].amount) +
          BigInt(cw20Events[3].amount) +
          BigInt(cw20Events[4].amount) -
          BigInt(cw20Events[5].amount)
        ).toString()
      );
      expect(
        holders.find(
          (e) =>
            e.address ===
            this.cw20Contract[contractIndex - 1].holders[1].address
        )?.amount
      ).toEqual(
        (
          BigInt(this.cw20Contract[contractIndex - 1].holders[1].amount) -
          BigInt(cw20Events[1].amount) +
          BigInt(cw20Events[2].amount) -
          BigInt(cw20Events[3].amount) -
          BigInt(cw20Events[4].amount)
        ).toString()
      );
      expect(
        holders.find(
          (e) =>
            e.address ===
            this.cw20Contract[contractIndex - 1].holders[2].address
        )?.amount
      ).toEqual(
        (
          BigInt(this.cw20Contract[contractIndex - 1].holders[2].amount) -
          BigInt(cw20Events[2].amount) +
          BigInt(cw20Events[5].amount)
        ).toString()
      );
      expect(
        holders.find(
          (e) =>
            e.address ===
            this.cw20Contract[contractIndex - 1].holders[0].address
        )?.last_updated_height
      ).toEqual(1005);
      expect(
        holders.find(
          (e) =>
            e.address ===
            this.cw20Contract[contractIndex - 1].holders[1].address
        )?.last_updated_height
      ).toEqual(1102);
      expect(
        holders.find(
          (e) =>
            e.address ===
            this.cw20Contract[contractIndex - 1].holders[2].address
        )?.last_updated_height
      ).toEqual(1102);
      await trx.rollback();
    });
  }

  @Test('test UpdateBalanceHolders for new holders')
  public async testUpdateBalanceNewHolders() {
    const contractIndex = 2;
    const newHolder = 'jdfjsdbfsdgjkhsdjkfgsdjk';
    const cw20Events = [
      {
        action: CW20_ACTION.MINT,
        amount: '87465765466',
        height: 1002,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
        to: newHolder,
      },
      {
        action: CW20_ACTION.BURN,
        amount: '4521443546',
        height: 1001,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
        from: newHolder,
      },
      {
        action: CW20_ACTION.TRANSFER,
        amount: '4642443',
        height: 1003,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
        to: this.cw20Contract[contractIndex - 1].holders[1].address,
        from: newHolder,
      },
      {
        action: CW20_ACTION.TRANSFER,
        amount: '1122334456566',
        height: 999,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
        to: newHolder,
        from: this.cw20Contract[contractIndex - 1].holders[1].address,
      },
      {
        action: CW20_ACTION.MINT,
        amount: '465462124654',
        height: 1005,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
        to: this.cw20Contract[contractIndex - 1].holders[2].address,
        from: this.cw20Contract[contractIndex - 1].holders[0].address,
      },
      {
        action: CW20_ACTION.SEND,
        amount: '852123655',
        height: 997,
        smart_contract_event_id: 1000,
        cw20_contract_id: 1,
        to: newHolder,
        from: this.cw20Contract[contractIndex - 1].holders[1].address,
      },
    ];
    await knex.transaction(async (trx) => {
      await this.cw20UpdateByContractService.updateBalanceHolders(
        cw20Events.map((event) => Cw20Event.fromJson(event)),
        contractIndex,
        trx
      );
      const holders = await CW20Holder.query()
        .transacting(trx)
        .where('cw20_contract_id', contractIndex)
        .throwIfNotFound();
      expect(holders.find((e) => e.address === newHolder)?.amount).toEqual(
        (
          BigInt(cw20Events[0].amount) -
          BigInt(cw20Events[1].amount) -
          BigInt(cw20Events[2].amount) +
          BigInt(cw20Events[3].amount) +
          BigInt(cw20Events[5].amount)
        ).toString()
      );
      await trx.rollback();
    });
  }
}
