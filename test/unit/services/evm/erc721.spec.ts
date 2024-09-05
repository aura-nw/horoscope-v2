import {
  AfterAll,
  BeforeAll,
  BeforeEach,
  Describe,
  Test,
} from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import {
  BlockCheckpoint,
  EVMSmartContract,
  EVMTransaction,
  Erc721Activity,
  Erc721Contract,
  Erc721Token,
  EvmEvent,
} from '../../../../src/models';
import Erc721Service from '../../../../src/services/evm/erc721.service';
import { ERC721_ACTION } from '../../../../src/services/evm/erc721_handler';
import { BULL_JOB_NAME } from '../../../../src/services/evm/constant';

@Describe('Test erc721')
export default class Erc721Test {
  broker = new ServiceBroker({ logger: false });

  erc721Service = this.broker.createService(Erc721Service) as Erc721Service;

  evmSmartContract = EVMSmartContract.fromJson({
    id: 555,
    address: '0x98605ae21dd3be686337a6d7a8f156d0d8baee92',
    creator: '0xc7663c6a454fc9971C93235A170c8997e8c5E661',
    created_height: 101,
    created_hash:
      '0x9ed3b06713baf17b7d7266294a82d51c36c84514a7d29f28585d85e586249525',
    type: EVMSmartContract.TYPES.ERC721,
    code_hash: '0x623d4ffdfa5555aa1234366sdaff1a1sdfafa4dasdfas4r',
  });

  evmSmartContract2 = EVMSmartContract.fromJson({
    id: 666,
    address: '0xc211C2CF383A38933f8352CBDd326B51b94574e6',
    creator: '0xc7663c6a454fc9971C93235A170c8997e8c5E661',
    created_height: 100,
    created_hash:
      '0x888d3b06713baf17b7d7266294a82d51c36c84514a7d29f28585d85e586252200',
    type: EVMSmartContract.TYPES.ERC721,
    code_hash: '0x5fdfa5555aa1234366sdaff1a1sdfafa4dasdfas4r',
  });

  evmTx = EVMTransaction.fromJson({
    id: 11111,
    hash: '',
    height: this.evmSmartContract.created_height,
    tx_msg_id: 222,
    tx_id: 223,
    contract_address: '',
    index: 1,
  });

  evmEvent = EvmEvent.fromJson({
    id: 1,
    tx_id: 1234,
    evm_tx_id: this.evmTx.id,
    tx_hash: '',
    address: '',
    block_height: 1,
    block_hash: '',
    tx_index: 1,
  });

  erc721Contract1 = Erc721Contract.fromJson({
    evm_smart_contract_id: this.evmSmartContract.id,
    id: 123,
    track: true,
    address: this.evmSmartContract.address,
  });

  blockCheckpoints = [
    BlockCheckpoint.fromJson({
      job_name: BULL_JOB_NAME.HANDLE_ERC721_ACTIVITY,
      height: 100,
    }),
    BlockCheckpoint.fromJson({
      job_name: BULL_JOB_NAME.HANDLE_ERC721_CONTRACT,
      height: 400,
    }),
  ];

  @BeforeAll()
  async initSuite() {
    await this.erc721Service.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE erc721_contract, account, erc721_activity, evm_smart_contract, evm_event, evm_transaction, block_checkpoint RESTART IDENTITY CASCADE'
    );
    await EVMSmartContract.query().insert([
      this.evmSmartContract,
      this.evmSmartContract2,
    ]);
    await EVMTransaction.query().insert(this.evmTx);
    // await EvmEvent.query().insert(this.evmEvent);
  }

  @BeforeEach()
  async beforeEach() {
    await knex.raw(
      'TRUNCATE TABLE erc721_contract, erc721_activity, erc721_token, block_checkpoint, evm_event RESTART IDENTITY CASCADE'
    );
    await Erc721Contract.query().insert(this.erc721Contract1);
    await BlockCheckpoint.query().insert(this.blockCheckpoints);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  @Test('test handleErc721Activity')
  async testHandleErc721Activity() {
    const erc721Events = [
      EvmEvent.fromJson({
        block_hash:
          '0x6d70a03cda3fb815b54742fbd47c6141a7e754ff4d7426f10a73644ac44411d2',
        block_height: this.blockCheckpoints[0].height + 1,
        data: null,
        topic0:
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        topic1:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        topic2:
          '0x0000000000000000000000001317df02a4e712265f5376a9d34156f73ebad640',
        topic3:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        address: this.evmSmartContract.address,
        evm_tx_id: this.evmTx.id,
        tx_id: 1234,
        tx_hash: this.evmTx.hash,
        tx_index: 1,
      }),
      EvmEvent.fromJson({
        block_hash:
          '0xd39b1e6c35a7985db6ca367b1e061162b7a8610097e99cadaf98bea6b81a6096',
        block_height: this.blockCheckpoints[0].height + 2,
        data: null,
        topic0:
          '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
        topic1:
          '0x0000000000000000000000001317df02a4e712265f5376a9d34156f73ebad640',
        topic2:
          '0x000000000000000000000000a3b6d252c1df2ce88f01fdb75b5479bcdc8f5007',
        topic3:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        address: this.evmSmartContract.address,
        evm_tx_id: this.evmTx.id,
        tx_id: 1234,
        tx_hash: this.evmTx.hash,
        tx_index: 1,
      }),
      EvmEvent.fromJson({
        block_hash:
          '0x6d70a03cda3fb815b54742fbd47c6141a7e754ff4d7426f10a73644ac44411d2',
        block_height: this.blockCheckpoints[0].height + 3,
        data: null,
        topic0:
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        topic1:
          '0x0000000000000000000000001317df02a4e712265f5376a9d34156f73ebad640',
        topic2:
          '0x000000000000000000000000e39633931ec4a1841e438b15005a6f141d30789e',
        topic3:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        address: this.evmSmartContract.address,
        evm_tx_id: this.evmTx.id,
        tx_id: 1234,
        tx_hash: this.evmTx.hash,
        tx_index: 1,
      }),
    ];
    await EvmEvent.query().insert(erc721Events);
    await this.erc721Service.handleErc721Activity();
    const erc721Token = await Erc721Token.query().first().throwIfNotFound();
    expect(erc721Token).toMatchObject({
      token_id: '0',
      owner: '0xe39633931ec4a1841e438b15005a6f141d30789e',
      erc721_contract_address: this.evmSmartContract.address,
    });
    const erc721Activities = await Erc721Activity.query().orderBy('height');
    expect(erc721Activities[0]).toMatchObject({
      action: ERC721_ACTION.TRANSFER,
      erc721_contract_address: erc721Events[0].address,
      from: '0x0000000000000000000000000000000000000000',
      to: '0x1317df02a4e712265f5376a9d34156f73ebad640',
      erc721_token_id: erc721Token.id,
    });
    expect(erc721Activities[1]).toMatchObject({
      action: ERC721_ACTION.APPROVAL,
      erc721_contract_address: erc721Events[0].address,
      from: '0x1317df02a4e712265f5376a9d34156f73ebad640',
      to: '0xa3b6d252c1df2ce88f01fdb75b5479bcdc8f5007',
      erc721_token_id: erc721Token.id,
    });
    expect(erc721Activities[2]).toMatchObject({
      action: ERC721_ACTION.TRANSFER,
      erc721_contract_address: erc721Events[0].address,
      from: '0x1317df02a4e712265f5376a9d34156f73ebad640',
      to: '0xe39633931ec4a1841e438b15005a6f141d30789e',
      erc721_token_id: erc721Token.id,
    });
    const erc721Contract = await Erc721Contract.query()
      .where('address', this.evmSmartContract.address)
      .first()
      .throwIfNotFound();
    expect(erc721Contract.total_supply).toEqual(1);
  }

  @Test('test erc721 totalSupply')
  async testErc721TotalSupply() {
    const erc721Events = [
      EvmEvent.fromJson({
        block_hash:
          '0x6d70a03cda3fb815b54742fbd47c6141a7e754ff4d7426f10a73644ac44411d2',
        block_height: this.blockCheckpoints[0].height + 1,
        data: null,
        topic0:
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        topic1:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        topic2:
          '0x0000000000000000000000001317df02a4e712265f5376a9d34156f73ebad640',
        topic3:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        address: this.evmSmartContract.address,
        evm_tx_id: this.evmTx.id,
        tx_id: 1234,
        tx_hash: this.evmTx.hash,
        tx_index: 1,
      }),
      EvmEvent.fromJson({
        block_hash:
          '0x6d70a03cda3fb815b54742fbd47c6141a7e754ff4d7426f10a73644ac44411d2',
        block_height: this.blockCheckpoints[0].height + 2,
        data: null,
        topic0:
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        topic1:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        topic2:
          '0x0000000000000000000000001317df02a4e712265f5376a9d34156f73ebad640',
        topic3:
          '0x0000000000000000000000000000000000000000000000000000000000000001',
        address: this.evmSmartContract.address,
        evm_tx_id: this.evmTx.id,
        tx_id: 1234,
        tx_hash: this.evmTx.hash,
        tx_index: 1,
      }),
      EvmEvent.fromJson({
        block_hash:
          '0x6d70a03cda3fb815b54742fbd47c6141a7e754ff4d7426f10a73644ac44411d2',
        block_height: this.blockCheckpoints[0].height + 3,
        data: null,
        topic0:
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        topic1:
          '0x0000000000000000000000001317df02a4e712265f5376a9d34156f73ebad640',
        topic2:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        topic3:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        address: this.evmSmartContract.address,
        evm_tx_id: this.evmTx.id,
        tx_id: 1234,
        tx_hash: this.evmTx.hash,
        tx_index: 1,
      }),
      EvmEvent.fromJson({
        block_hash:
          '0x6d70a03cda3fb815b54742fbd47c6141a7e754ff4d7426f10a73644ac44411d2',
        block_height: this.blockCheckpoints[0].height + 4,
        data: null,
        topic0:
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        topic1:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        topic2:
          '0x0000000000000000000000001317df02a4e712265f5376a9d34156f73ebad640',
        topic3:
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        address: this.evmSmartContract.address,
        evm_tx_id: this.evmTx.id,
        tx_id: 1234,
        tx_hash: this.evmTx.hash,
        tx_index: 1,
      }),
    ];
    await EvmEvent.query().insert(erc721Events);
    await this.erc721Service.handleErc721Activity();
    const erc721Contract = await Erc721Contract.query()
      .where('address', this.evmSmartContract.address)
      .first()
      .throwIfNotFound();
    expect(erc721Contract.total_supply).toEqual(2);
  }
}
