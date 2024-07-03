import {
  AfterAll,
  BeforeAll,
  BeforeEach,
  Describe,
  Test,
} from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import knex from '../../../../src/common/utils/db_connection';
import {
  Account,
  EVMSmartContract,
  EVMTransaction,
  Erc20Activity,
  Erc20Contract,
  Erc20Statistic,
  EvmEvent,
} from '../../../../src/models';
import Erc20Service from '../../../../src/services/evm/erc20.service';

@Describe('Test erc20 handler')
export default class Erc20Test {
  broker = new ServiceBroker({ logger: false });

  erc20Service = this.broker.createService(Erc20Service) as Erc20Service;

  evmSmartContract = EVMSmartContract.fromJson({
    id: 555,
    address: 'ghghdfgdsgre',
    creator: 'dfgdfbvxcvxgfds',
    created_height: 100,
    created_hash: 'cvxcvcxv',
    type: EVMSmartContract.TYPES.ERC20,
    code_hash: 'dfgdfghf',
  });

  evmSmartContract2 = EVMSmartContract.fromJson({
    id: 666,
    address: 'bcvbcvbcv',
    creator: 'dfgdfbvxcvxgfds',
    created_height: 100,
    created_hash: 'xdasfsf',
    type: EVMSmartContract.TYPES.PROXY_EIP_1967,
    code_hash: 'xcsadf',
  });

  evmTx = EVMTransaction.fromJson({
    id: 11111,
    hash: '',
    height: 111,
    tx_msg_id: 222,
    tx_id: 223,
    contract_address: '',
    index: 1,
  });

  evmEvent = EvmEvent.fromJson({
    id: 888,
    tx_id: 1234,
    evm_tx_id: this.evmTx.id,
    tx_hash: '',
    address: '',
    block_height: 1,
    block_hash: '',
    tx_index: 1,
  });

  @BeforeAll()
  async initSuite() {
    this.erc20Service.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE erc20_contract, account, erc20_activity, evm_smart_contract, evm_event, evm_transaction RESTART IDENTITY CASCADE'
    );
    await EVMSmartContract.query().insert([
      this.evmSmartContract,
      this.evmSmartContract2,
    ]);
    await EVMTransaction.query().insert(this.evmTx);
    await EvmEvent.query().insert(this.evmEvent);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @BeforeEach()
  async initSuiteBeforeEach() {
    await knex.raw(
      'TRUNCATE TABLE erc20_activity, account, erc20_statistic RESTART IDENTITY CASCADE'
    );
  }

  @Test('test getErc20Activities')
  async testGetErc20Activities() {
    const fromAccount = Account.fromJson({
      id: 123,
      address: 'fgsdgfdfgdfgfsdg',
      balances: [],
      spendable_balances: [],
      type: '',
      pubkey: '',
      account_number: 1,
      sequence: 234,
      evm_address: '0x124537cfdxvfsdfgv',
    });
    const toAccount = Account.fromJson({
      id: 345,
      address: 'xczfsdfsfsdg',
      balances: [],
      spendable_balances: [],
      type: '',
      pubkey: '',
      account_number: 2,
      sequence: 432,
      evm_address: '0xghgfhfghfg',
    });
    await Account.query().insert([fromAccount, toAccount]);
    const erc20Contracts = [
      {
        ...Erc20Contract.fromJson({
          id: 444,
          evm_smart_contract_id: this.evmSmartContract.id,
          total_supply: 123456,
          symbol: 'PHO',
          address: this.evmSmartContract.address,
          decimal: 'fggdfgdgdg',
          name: 'Phong',
          track: true,
          last_updated_height: 200,
        }),
        activities: [
          {
            ...Erc20Activity.fromJson({
              id: 44444,
              evm_event_id: this.evmEvent.id,
              sender: 'fdgdfgdf',
              action: 'transfer',
              erc20_contract_address: this.evmSmartContract.address,
              amount: '4543',
              from: fromAccount.evm_address,
              to: toAccount.evm_address,
              height: 400,
              tx_hash: 'dfghdfhdfhgdf',
              evm_tx_id: this.evmTx.id,
            }),
          },
          {
            ...Erc20Activity.fromJson({
              id: 1234,
              evm_event_id: this.evmEvent.id,
              sender: 'vgcxbvb',
              action: 'transfer',
              erc20_contract_address: this.evmSmartContract.address,
              amount: '666666',
              from: fromAccount.evm_address,
              to: toAccount.evm_address,
              height: 401,
              tx_hash: 'dfghdfhdfhgdf',
              evm_tx_id: this.evmTx.id,
            }),
          },
        ],
      },
      {
        ...Erc20Contract.fromJson({
          id: 445,
          evm_smart_contract_id: this.evmSmartContract2.id,
          total_supply: 15555,
          symbol: 'ABC',
          address: this.evmSmartContract2.address,
          decimal: 'vbvbgdfg',
          name: 'Abc',
          track: false,
          last_updated_height: 200,
        }),
        activities: [
          {
            ...Erc20Activity.fromJson({
              id: 4444211,
              evm_event_id: this.evmEvent.id,
              sender: 'fdgdfgdf',
              action: 'transfer',
              erc20_contract_address: this.evmSmartContract2.address,
              amount: '4543',
              from: fromAccount.evm_address,
              to: toAccount.evm_address,
              height: 400,
              tx_hash: 'dfghdfhdfhgdf',
              evm_tx_id: this.evmTx.id,
            }),
          },
        ],
      },
    ];
    await Erc20Contract.query().insertGraph(erc20Contracts);
    const result = await this.erc20Service.getErc20Activities(0, 10000000);
    expect(result.length).toEqual(2);
    expect(result[0]).toMatchObject(erc20Contracts[0].activities[1]);
    expect(result[0].from_account_id).toEqual(fromAccount.id);
    expect(result[0].to_account_id).toEqual(toAccount.id);
    expect(result[1]).toMatchObject(erc20Contracts[0].activities[0]);
    expect(result[1].from_account_id).toEqual(fromAccount.id);
    expect(result[1].to_account_id).toEqual(toAccount.id);
  }

  @Test('test handleTotalHolderStatistic')
  public async testHandleTotalHolderStatistic() {
    const accounts = [
      Account.fromJson({
        id: 345,
        address: 'xczfsdfsfsdg',
        balances: [],
        spendable_balances: [],
        type: '',
        pubkey: '',
        account_number: 2,
        sequence: 432,
        evm_address: '0xghgfhfghfg',
        account_balances: [
          {
            denom: this.evmSmartContract.address,
            amount: 123,
          },
          {
            denom: this.evmSmartContract2.address,
            amount: 1234,
          },
        ],
      }),
      Account.fromJson({
        id: 456,
        address: 'cbbvb',
        balances: [],
        spendable_balances: [],
        type: '',
        pubkey: '',
        account_number: 2,
        sequence: 432,
        evm_address: '0xhgfhfghgfg',
        account_balances: [
          {
            denom: this.evmSmartContract.address,
            amount: 0,
          },
          {
            denom: this.evmSmartContract2.address,
            amount: -1234,
          },
        ],
      }),
      Account.fromJson({
        id: 567,
        address: 'xzxzcvv ',
        balances: [],
        spendable_balances: [],
        type: '',
        pubkey: '',
        account_number: 2,
        sequence: 432,
        evm_address: '0xdgfsdgs4',
        account_balances: [
          {
            denom: this.evmSmartContract.address,
            amount: 1,
          },
        ],
      }),
    ];
    await Account.query().insertGraph(accounts);
    const date = new Date('2023-01-12T00:53:57.000Z');
    await this.erc20Service.handleTotalHolderStatistic(date);
    const erc20Statistics = _.keyBy(
      await Erc20Statistic.query(),
      'erc20_contract_id'
    );
    expect(erc20Statistics[444]).toMatchObject({
      total_holder: 2,
    });
    // because of track false
    expect(erc20Statistics[445]).toBeUndefined();
  }
}
