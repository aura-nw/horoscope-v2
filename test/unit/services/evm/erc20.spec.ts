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
import { BULL_JOB_NAME, SERVICE } from '../../../../src/services/evm/constant';
import { SERVICE as COSMOS_SERVICE } from '../../../../src/common/constant';
import config from '../../../../config.json' assert { type: 'json' };
import { convertEthAddressToBech32Address } from '../../../../src/services/evm/utils';

async function cleanQueue(erc20Service: Erc20Service) {
  await erc20Service
    .getQueueManager()
    .getQueue(BULL_JOB_NAME.HANDLE_ERC20_CONTRACT)
    .drain(true);
  await erc20Service
    .getQueueManager()
    .getQueue(BULL_JOB_NAME.HANDLE_ERC20_ACTIVITY)
    .drain(true);
  await erc20Service
    .getQueueManager()
    .getQueue(BULL_JOB_NAME.HANDLE_ERC20_BALANCE)
    .drain(true);
}
@Describe('Test erc20 handle balance job')
export class Erc20Test {
  broker = new ServiceBroker({ logger: false });

  erc20Service = this.broker.createService(Erc20Service) as Erc20Service;

  evmSmartContract = EVMSmartContract.fromJson({
    id: 1,
    address: '0xE974cC14c93FC6077B0d65F98832B846C5454A0B',
    creator: '0x5606b4eA93F696Dd82Ca983BAF5723d00729f127',
    created_height: 100,
    created_hash:
      '0x8c46cf6373f2f6e528b56becf0ce6b460b5d90cf9b0325a136b9b3a820e1e489',
    type: EVMSmartContract.TYPES.ERC20,
    code_hash: '0xdsf3335453454tsgfsdrtserf43645y4h4tAAvfgfgds',
  });

  evmSmartContract2 = EVMSmartContract.fromJson({
    id: 2,
    address: '0x3CB367e7C920Ff15879Bd4CBd708b8c60eB0f537',
    creator: '0xa9497CC4F95773A744D408b54dAC724626ee31d2',
    created_height: 100,
    created_hash:
      '0x5bca9ee42c4c32941c58f2a510dae5ff5c6ed848d9a396a8e9e146a166b3a3fc',
    type: EVMSmartContract.TYPES.PROXY_EIP_1967,
    code_hash: '0xdfskjgdsgfgweruwie4535t3tu34tjkewtgjwe',
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

  account1 = Account.fromJson({
    id: 1,
    address: 'aura1w9vxuke5dz6hyza2j932qgmxltnfxwl7gdfgdg',
    balances: [],
    spendable_balances: [],
    type: '',
    pubkey: '',
    account_number: 1,
    sequence: 234,
    evm_address: '0xDF587daaC47ae7B5586E34bCdb23d0b900b18a6C',
  });

  account2 = Account.fromJson({
    id: 2,
    address: 'aura1w9vxuke5dz6hyza2j932qgmxltnfxwl7qlx4mg',
    balances: [],
    spendable_balances: [],
    type: '',
    pubkey: '',
    account_number: 2,
    sequence: 432,
    evm_address: '0x71586E5B3468B5720BAa9162A02366Fae6933BfE',
  });

  account3 = Account.fromJson({
    id: 3,
    address: 'aura888vxuke5dz6hyza2j932qgmxltnfxwl7sfsfs',
    balances: [],
    spendable_balances: [],
    type: '',
    pubkey: '',
    account_number: 3,
    sequence: 432,
    evm_address: '0x7c756Cba10Ff2C65016494E8BA37C12a108572b5',
  });

  blockCheckpoints = [
    BlockCheckpoint.fromJson({
      job_name: BULL_JOB_NAME.HANDLE_ERC20_BALANCE,
      height: 100,
    }),
    BlockCheckpoint.fromJson({
      job_name: BULL_JOB_NAME.HANDLE_ERC20_ACTIVITY,
      height: 1000,
    }),
  ];

  @BeforeAll()
  async initSuite() {
    await cleanQueue(this.erc20Service);
    await this.erc20Service.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE erc20_contract, account, erc20_activity, evm_smart_contract, evm_event, evm_transaction, account_balance, block_checkpoint RESTART IDENTITY CASCADE'
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
      'TRUNCATE TABLE erc20_activity, block_checkpoint, account RESTART IDENTITY CASCADE'
    );
    await BlockCheckpoint.query().insert(this.blockCheckpoints);
    await Account.query().insert([this.account1, this.account2, this.account3]);
  }

  @AfterAll()
  async tearDown() {
    await cleanQueue(this.erc20Service);
    await this.broker.stop();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  @Test('handle erc20 balance success')
  async testHandleErc20Balance() {
    const erc20Activities = [
      {
        id: 1,
        evm_event_id: this.evmEvent.id,
        sender: '0xDF587daaC47ae7B5586E34bCdb23d0b900b18a6C',
        action: 'transfer',
        erc20_contract_address: this.evmSmartContract.address,
        amount: '4543',
        from: this.account1.evm_address,
        to: this.account2.evm_address,
        height: this.blockCheckpoints[0].height + 1,
        tx_hash:
          '0x21f905f14a26c5b35e43e1bfbcf8ff395e453d6497a0ce0a0c3cd7814ec0ba03',
        evm_tx_id: this.evmTx.id,
      },
      {
        id: 2,
        evm_event_id: this.evmEvent.id,
        sender: '0xDF587daaC47ae7B5586E34bCdb23d0b900b18a6C',
        action: 'transfer',
        erc20_contract_address: this.evmSmartContract.address,
        amount: '2211',
        from: this.account2.evm_address,
        to: this.account3.evm_address,
        height: this.blockCheckpoints[0].height + 1,
        tx_hash:
          '0x21f905f14a26c5b35e43e1bfbcf8ff395e453d6497a0ce0a0c3cd7814ec0ba03',
        evm_tx_id: this.evmTx.id,
      },
      {
        id: 3,
        evm_event_id: this.evmEvent.id,
        sender: '0xDF587daaC47ae7B5586E34bCdb23d0b900b18a6C',
        action: 'approval',
        erc20_contract_address: this.evmSmartContract.address,
        amount: '2211',
        from: this.account2.evm_address,
        to: this.account3.evm_address,
        height: this.blockCheckpoints[0].height + 1,
        tx_hash:
          '0x21f905f14a26c5b35e43e1bfbcf8ff395e453d6497a0ce0a0c3cd7814ec0ba03',
        evm_tx_id: this.evmTx.id,
      },
    ];
    await Erc20Activity.query().insert(erc20Activities);
    await this.erc20Service.handleErc20Balance();
    const accountBalances = _.keyBy(
      await AccountBalance.query(),
      (o) => `${o.account_id}_${o.denom}`
    );
    expect(
      accountBalances[`${this.account1.id}_${this.evmSmartContract.address}`]
        .amount
    ).toEqual(`-${BigInt(erc20Activities[0].amount).toString()}`);
    expect(
      accountBalances[`${this.account2.id}_${this.evmSmartContract.address}`]
        .amount
    ).toEqual(
      `${(
        BigInt(erc20Activities[0].amount) - BigInt(erc20Activities[1].amount)
      ).toString()}`
    );
    expect(
      accountBalances[`${this.account3.id}_${this.evmSmartContract.address}`]
        .amount
    ).toEqual(`${BigInt(erc20Activities[1].amount).toString()}`);
    const erc20Contract = await Erc20Contract.query()
      .where('address', this.evmSmartContract.address)
      .first()
      .throwIfNotFound();
    expect(erc20Contract.no_action).toEqual({
      transfer: erc20Activities.length - 1,
      approval: 1,
    });
  }

  @Test('handle erc20 balance with missing account')
  async testHandleErc20BalanceWithMissingAccount() {
    const missingAccountId = 5;
    const missingAccountAddr = '0x5606b4eA93F696Dd82Ca983BAF5723d00729f127';
    const erc20Activities = [
      {
        id: 1,
        evm_event_id: this.evmEvent.id,
        sender: '0xDF587daaC47ae7B5586E34bCdb23d0b900b18a6C',
        action: 'transfer',
        erc20_contract_address: this.evmSmartContract.address,
        amount: '4543',
        from: this.account1.evm_address,
        to: this.account2.evm_address,
        height: this.blockCheckpoints[0].height + 1,
        tx_hash:
          '0x21f905f14a26c5b35e43e1bfbcf8ff395e453d6497a0ce0a0c3cd7814ec0ba03',
        evm_tx_id: this.evmTx.id,
      },
      {
        id: 2,
        evm_event_id: this.evmEvent.id,
        sender: '0xDF587daaC47ae7B5586E34bCdb23d0b900b18a6C',
        action: 'transfer',
        erc20_contract_address: this.evmSmartContract.address,
        amount: '2211',
        from: missingAccountAddr,
        to: this.account3.evm_address,
        height: this.blockCheckpoints[0].height + 1,
        tx_hash:
          '0x21f905f14a26c5b35e43e1bfbcf8ff395e453d6497a0ce0a0c3cd7814ec0ba03',
        evm_tx_id: this.evmTx.id,
      },
    ];
    await Erc20Activity.query().insert(erc20Activities);
    const mockCall = jest
      .spyOn(this.erc20Service.broker, 'call')
      .mockImplementation(async () =>
        Promise.resolve(
          Account.query().insert(
            Account.fromJson({
              id: missingAccountId,
              address: 'aura12crtf65n76tdmqk2nqa674er6qrjnuf8h89p22',
              balances: [],
              spendable_balances: [],
              type: '',
              pubkey: '',
              account_number: 4,
              sequence: 2,
              evm_address: missingAccountAddr,
            })
          )
        )
      );
    await this.erc20Service.handleErc20Balance();
    const accountBalances = _.keyBy(
      await AccountBalance.query(),
      (o) => `${o.account_id}_${o.denom}`
    );
    if (!config.evmOnly) {
      expect(mockCall).toHaveBeenCalledWith(
        COSMOS_SERVICE.V1.HandleAddressService.CrawlNewAccountApi.path,
        {
          addresses: [
            convertEthAddressToBech32Address(
              config.networkPrefixAddress,
              missingAccountAddr
            ),
          ],
        }
      );
    } else {
      expect(mockCall).toHaveBeenCalledWith(
        SERVICE.V1.CrawlEvmAccount.CrawlNewAccountApi.path,
        {
          addresses: [missingAccountAddr],
        }
      );
    }
    expect(
      accountBalances[`${this.account1.id}_${this.evmSmartContract.address}`]
        .amount
    ).toEqual(`-${BigInt(erc20Activities[0].amount).toString()}`);
    expect(
      accountBalances[`${this.account2.id}_${this.evmSmartContract.address}`]
        .amount
    ).toEqual(`${BigInt(erc20Activities[0].amount).toString()}`);
    expect(
      accountBalances[`${missingAccountId}_${this.evmSmartContract.address}`]
        .amount
    ).toEqual(`-${BigInt(erc20Activities[1].amount).toString()}`);
    expect(
      accountBalances[`${this.account3.id}_${this.evmSmartContract.address}`]
        .amount
    ).toEqual(`${BigInt(erc20Activities[1].amount).toString()}`);
    const erc20Contract = await Erc20Contract.query()
      .where('address', this.evmSmartContract.address)
      .first()
      .throwIfNotFound();
    expect(erc20Contract.no_action).toEqual({
      transfer: erc20Activities.length + 2,
      approval: 1,
    });
  }
}
