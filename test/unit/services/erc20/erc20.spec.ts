import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import {
  Account,
  EVMSmartContract,
  EVMTransaction,
  Erc20Activity,
  Erc20Contract,
  EvmEvent,
  EvmProxyHistory,
} from '../../../../src/models';
import knex from '../../../../src/common/utils/db_connection';
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
    type: EVMSmartContract.TYPES.ERC20,
    code_hash: 'xcsadf',
  });

  evmSmartContract3 = EVMSmartContract.fromJson({
    id: 777,
    address: 'mhhgmgjghj',
    creator: 'nbvnvbn',
    created_height: 100,
    created_hash: 'qeqeqe',
    type: EVMSmartContract.TYPES.ERC20,
    code_hash: 'dcxvbxcbx',
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
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE erc20_contract, account, erc20_activity, evm_smart_contract, evm_event, evm_transaction, evm_proxy_history RESTART IDENTITY CASCADE'
    );
    await EVMSmartContract.query().insert([
      this.evmSmartContract,
      this.evmSmartContract2,
      this.evmSmartContract3,
    ]);
    await EVMTransaction.query().insert(this.evmTx);
    await EvmEvent.query().insert(this.evmEvent);
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

  @Test('getCurrentErc20Proxies')
  async testGetCurrentErc20Proxies() {
    const implementation1 = 'dsasfdsfsdf';
    const implementation2 = 'hchchchc';
    const proxyHistories = [
      EvmProxyHistory.fromJson({
        proxy_contract: this.evmSmartContract.address,
        implementation_contract: 'dghdghgg',
        tx_hash: 'sfserwerwr',
        block_height: 100,
        last_updated_height: null,
      }),
      EvmProxyHistory.fromJson({
        proxy_contract: this.evmSmartContract.address,
        implementation_contract: 'zzzzzzz',
        tx_hash: 'drfder',
        block_height: null,
        last_updated_height: 99,
      }),
      EvmProxyHistory.fromJson({
        proxy_contract: this.evmSmartContract.address,
        implementation_contract: implementation1,
        tx_hash: '',
        block_height: 98,
        last_updated_height: null,
      }),
      EvmProxyHistory.fromJson({
        proxy_contract: this.evmSmartContract2.address,
        implementation_contract: implementation2,
        tx_hash: 'sfserwerwr',
        block_height: 1001,
        last_updated_height: null,
      }),
      EvmProxyHistory.fromJson({
        proxy_contract: this.evmSmartContract2.address,
        implementation_contract: 'zzzzzzz',
        tx_hash: 'drfder',
        block_height: null,
        last_updated_height: 991,
      }),
      EvmProxyHistory.fromJson({
        proxy_contract: this.evmSmartContract2.address,
        implementation_contract: 'dfgdfgfbvcbvbv',
        tx_hash: '',
        block_height: 981,
        last_updated_height: null,
      }),
      EvmProxyHistory.fromJson({
        proxy_contract: this.evmSmartContract3.address,
        implementation_contract: 'vcxbvcbcnvbhdf',
        tx_hash: '',
        block_height: 981,
        last_updated_height: null,
      }),
    ];
    await knex.transaction(async (trx) => {
      await EvmProxyHistory.query().insert(proxyHistories).transacting(trx);
      const results = await this.erc20Service.getCurrentErc20Proxies(
        [implementation1, implementation2],
        trx
      );
      expect(results.length).toEqual(1);
      expect(results[0]).toMatchObject({
        address: this.evmSmartContract2.address,
        implementation_contract: implementation2,
        created_height: 1001,
        id: this.evmSmartContract2.id,
      });
    });
  }
}
