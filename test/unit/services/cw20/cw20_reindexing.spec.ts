import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import Cw20ReindexingContract from '../../../../src/services/cw20/cw20_reindexing.service';
import { Code, Cw20Contract, CW20Holder } from '../../../../src/models';
import Cw20UpdateByContractService from '../../../../src/services/cw20/cw20_update_by_contract.service';
import Cw20Service from '../../../../src/services/cw20/cw20.service';

@Describe('Test cw20 reindexing service')
export default class TestCw20ReindexingService {
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

  cw20Contract = {
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
  };

  broker = new ServiceBroker({ logger: false });

  cw20reindexingService = this.broker.createService(
    Cw20ReindexingContract
  ) as Cw20ReindexingContract;

  cw20UpdateByContractService = this.broker.createService(
    Cw20UpdateByContractService
  ) as Cw20UpdateByContractService;

  cw20Service = this.broker.createService(Cw20Service) as Cw20Service;

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE code, cw20_contract, block_checkpoint RESTART IDENTITY CASCADE'
    );
    await Code.query().insertGraph(this.codeId);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @Test('Test ReindexingService function')
  public async testReindexingService() {
    const mockContractInfo = {
      address: this.codeId.contracts[0].address,
      name: 'dgjkfjgdkg',
      symbol: 'NNNJNJ',
      minter: 'hfgjksghkjsf',
    };
    const mockHolders = [
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
        amount: '5467987',
        event_height: 9600,
        contract_address: this.codeId.contracts[0].address,
      },
      {
        address: 'holder_4',
        amount: '11111111',
        event_height: 23655422,
        contract_address: this.codeId.contracts[0].address,
      },
    ];
    this.cw20Service.reindexHistory = jest.fn(() => Promise.resolve());
    this.cw20UpdateByContractService.UpdateByContract = jest.fn(() =>
      Promise.resolve()
    );
    Cw20Contract.getContractsInfo = jest.fn(() =>
      Promise.resolve([mockContractInfo])
    );
    Cw20Contract.getInstantiateBalances = jest.fn(() =>
      Promise.resolve(mockHolders)
    );
    await this.cw20reindexingService.jobHandler({
      contractAddress: this.codeId.contracts[0].address,
      smartContractId: 1,
    });
    const cw20Contract = await Cw20Contract.query()
      .withGraphJoined('smart_contract')
      .where('smart_contract.address', this.codeId.contracts[0].address)
      .first()
      .throwIfNotFound();
    expect(cw20Contract.name).toEqual(mockContractInfo.name);
    expect(cw20Contract.minter).toEqual(mockContractInfo.minter);
    expect(cw20Contract.symbol).toEqual(mockContractInfo.symbol);
    const cw20Holders = await CW20Holder.query()
      .withGraphJoined('token')
      .where('token.id', cw20Contract.id)
      .orderBy('address', 'asc');
    expect(
      cw20Holders.map((cw20Holder) => ({
        address: cw20Holder.address,
        amount: cw20Holder.amount,
        event_height: cw20Holder.last_updated_height,
        contract_address: this.codeId.contracts[0].address,
      }))
    ).toEqual(mockHolders);
  }
}
