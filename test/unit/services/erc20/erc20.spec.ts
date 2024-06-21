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
  AccountBalance,
  BlockCheckpoint,
  EVMSmartContract,
  EVMTransaction,
  Erc20Activity,
  Erc20Contract,
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

  erc20Contracts = [
    Erc20Contract.fromJson({
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
    Erc20Contract.fromJson({
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
  ];

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE erc20_contract, account, erc20_activity, evm_smart_contract, evm_event, evm_transaction, account_balance RESTART IDENTITY CASCADE'
    );
    await EVMSmartContract.query().insert([
      this.evmSmartContract,
      this.evmSmartContract2,
    ]);
    await EVMTransaction.query().insert(this.evmTx);
    await EvmEvent.query().insert(this.evmEvent);
    await Erc20Contract.query().insert(this.erc20Contracts);
  }

  @BeforeEach()
  async beforeEach() {
    await knex.raw(
      'TRUNCATE TABLE erc20_activity, account RESTART IDENTITY CASCADE'
    );
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
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
    const erc20Activites = [
      Erc20Activity.fromJson({
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
      Erc20Activity.fromJson({
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
      Erc20Activity.fromJson({
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
    ];
    await Erc20Activity.query().insert(erc20Activites);
    const result = await this.erc20Service.getErc20Activities(0, 10000000);
    expect(result.length).toEqual(2);
    expect(result[0]).toMatchObject(erc20Activites[1]);
    expect(result[0].from_account_id).toEqual(fromAccount.id);
    expect(result[0].to_account_id).toEqual(toAccount.id);
    expect(result[1]).toMatchObject(erc20Activites[0]);
    expect(result[1].from_account_id).toEqual(fromAccount.id);
    expect(result[1].to_account_id).toEqual(toAccount.id);
  }

  @Test('test handleErc20Balance')
  async testHandleErc20Balance() {
    jest.spyOn(BlockCheckpoint, 'getCheckpoint').mockResolvedValue([
      this.evmSmartContract.created_height - 1,
      this.evmSmartContract.created_height,
      BlockCheckpoint.fromJson({
        job_name: 'dfdsfgsg',
        height: this.evmSmartContract.created_height - 1,
      }),
    ]);
    const account1 = Account.fromJson({
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
    const account2 = Account.fromJson({
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
    const account3 = Account.fromJson({
      id: 456,
      address: 'uvvvvvvxxxx',
      balances: [],
      spendable_balances: [],
      type: '',
      pubkey: '',
      account_number: 3,
      sequence: 432,
      evm_address: '0xabcxyz',
    });
    await Account.query().insert([account1, account2, account3]);
    const erc20Activities = [
      {
        id: 44444,
        evm_event_id: this.evmEvent.id,
        sender: 'fdgdfgdf',
        action: 'transfer',
        erc20_contract_address: this.evmSmartContract.address,
        amount: '4543',
        from_account_id: account1.id,
        to_account_id: account2.id,
        from: account1.evm_address,
        to: account2.evm_address,
        height: 400,
        tx_hash: 'dfghdfhdfhgdf',
        evm_tx_id: this.evmTx.id,
      },
      {
        id: 44444,
        evm_event_id: this.evmEvent.id,
        sender: 'fdgdfgdf',
        action: 'transfer',
        erc20_contract_address: this.evmSmartContract.address,
        amount: '2211',
        from_account_id: account2.id,
        to_account_id: account3.id,
        from: account2.evm_address,
        to: account3.evm_address,
        height: 400,
        tx_hash: 'dfghdfhdfhgdf',
        evm_tx_id: this.evmTx.id,
      },
    ];
    jest
      .spyOn(this.erc20Service, 'getErc20Activities')
      .mockResolvedValue(erc20Activities.map((e) => Erc20Activity.fromJson(e)));
    await this.erc20Service.handleErc20Balance();
    const accountBalances = _.keyBy(
      await AccountBalance.query(),
      (o) => `${o.account_id}_${o.denom}`
    );
    expect(
      accountBalances[`${account1.id}_${this.evmSmartContract.address}`].amount
    ).toEqual(`-${BigInt(erc20Activities[0].amount).toString()}`);
    expect(
      accountBalances[`${account2.id}_${this.evmSmartContract.address}`].amount
    ).toEqual(
      `${(
        BigInt(erc20Activities[0].amount) - BigInt(erc20Activities[1].amount)
      ).toString()}`
    );
    expect(
      accountBalances[`${account3.id}_${this.evmSmartContract.address}`].amount
    ).toEqual(`${BigInt(erc20Activities[1].amount).toString()}`);
  }
}
