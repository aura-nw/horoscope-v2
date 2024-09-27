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
  BlockCheckpoint,
  EVMSmartContract,
  EVMTransaction,
  Erc721Activity,
  Erc721Contract,
  Erc721HolderStatistic,
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
    created_height: 100,
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
    from: '0x38828FA9766dE6eb49011fCC970ed1beFE15974a',
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
      height: this.evmTx.height - 1,
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
      'TRUNCATE TABLE erc721_contract, account, erc721_activity, evm_smart_contract, evm_event, evm_transaction, block_checkpoint, erc721_holder_statistic RESTART IDENTITY CASCADE'
    );
    await EVMSmartContract.query().insert([
      this.evmSmartContract,
      this.evmSmartContract2,
    ]);
    await Erc721Contract.query().insert(this.erc721Contract1);
    await EVMTransaction.query().insert(this.evmTx);
    await EvmEvent.query().insert(this.evmEvent);
  }

  @BeforeEach()
  async beforeEach() {
    await knex.raw(
      'TRUNCATE TABLE erc721_activity, erc721_token, block_checkpoint, evm_event RESTART IDENTITY CASCADE'
    );
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
    const holder1 = '0x1317df02a4e712265f5376a9d34156f73ebad640';
    const holder2 = '0xa3b6d252c1df2ce88f01fdb75b5479bcdc8f5007';
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
        topic2: `0x000000000000000000000000${holder1.slice(2)}`,
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
        topic1: `0x000000000000000000000000${holder1.slice(2)}`,
        topic2: `0x000000000000000000000000${holder2.slice(2)}`,
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
        topic1: `0x000000000000000000000000${holder1.slice(2)}`,
        topic2: `0x000000000000000000000000${holder2.slice(2)}`,
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
      owner: holder2,
      erc721_contract_address: this.evmSmartContract.address,
    });
    const erc721Activities = await Erc721Activity.query().orderBy('height');
    expect(erc721Activities[0]).toMatchObject({
      action: ERC721_ACTION.TRANSFER,
      erc721_contract_address: erc721Events[0].address,
      from: '0x0000000000000000000000000000000000000000',
      to: holder1,
      erc721_token_id: erc721Token.id,
    });
    expect(erc721Activities[1]).toMatchObject({
      action: ERC721_ACTION.APPROVAL,
      erc721_contract_address: erc721Events[0].address,
      from: holder1,
      to: holder2,
      erc721_token_id: erc721Token.id,
    });
    expect(erc721Activities[2]).toMatchObject({
      action: ERC721_ACTION.TRANSFER,
      erc721_contract_address: erc721Events[0].address,
      from: holder1,
      to: holder2,
      erc721_token_id: erc721Token.id,
    });
    const erc721Contract = await Erc721Contract.query()
      .first()
      .throwIfNotFound();
    expect(erc721Contract.total_supply).toEqual('1');
    expect(erc721Contract.total_actions).toEqual({
      [ERC721_ACTION.TRANSFER]: 2,
      [ERC721_ACTION.APPROVAL]: 1,
    });
    const erc721HolderStats = _.keyBy(
      await Erc721HolderStatistic.query(),
      'owner'
    );
    expect(erc721HolderStats[holder1].count).toEqual('0');
    expect(erc721HolderStats[holder2].count).toEqual('1');
  }
}
