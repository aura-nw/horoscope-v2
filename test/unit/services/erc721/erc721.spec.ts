import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import {
  BlockCheckpoint,
  EVMSmartContract,
  EVMTransaction,
  Erc721Activity,
  Erc721Token,
  EvmEvent,
} from '../../../../src/models';
import Erc721Service from '../../../../src/services/evm/erc721.service';
import { ERC721_ACTION } from '../../../../src/services/evm/erc721_handler';

@Describe('Test erc721')
export default class Erc721Test {
  broker = new ServiceBroker({ logger: false });

  erc721Service = this.broker.createService(Erc721Service) as Erc721Service;

  evmSmartContract = EVMSmartContract.fromJson({
    id: 555,
    address: 'ghghdfgdsgre',
    creator: 'dfgdfbvxcvxgfds',
    created_height: 100,
    created_hash: 'cvxcvcxv',
    type: EVMSmartContract.TYPES.ERC721,
    code_hash: 'dfgdfghf',
  });

  evmSmartContract2 = EVMSmartContract.fromJson({
    id: 666,
    address: 'bcvbcvbcv',
    creator: 'dfgdfbvxcvxgfds',
    created_height: 100,
    created_hash: 'xdasfsf',
    type: EVMSmartContract.TYPES.ERC721,
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
    this.erc721Service.getQueueManager().stopAll();
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE erc721_contract, account, erc721_activity, evm_smart_contract, evm_event, evm_transaction, block_checkpoint RESTART IDENTITY CASCADE'
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
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  @Test('test handleErc721Activity')
  async testHandleErc721Activity() {
    jest.spyOn(BlockCheckpoint, 'getCheckpoint').mockResolvedValue([
      this.evmSmartContract.created_height - 1,
      this.evmSmartContract.created_height,
      BlockCheckpoint.fromJson({
        job_name: 'dfdsfgsg',
        height: this.evmSmartContract.created_height - 1,
      }),
    ]);
    const erc721Events = [
      EvmEvent.fromJson({
        id: this.evmEvent.id,
        block_hash:
          '0x6d70a03cda3fb815b54742fbd47c6141a7e754ff4d7426f10a73644ac44411d2',
        block_height: 21937980,
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
        sender: 'fgfdg',
        evm_smart_contract_id: this.evmSmartContract.id,
        track: true,
      }),
      EvmEvent.fromJson({
        id: this.evmEvent.id,
        block_hash:
          '0xd39b1e6c35a7985db6ca367b1e061162b7a8610097e99cadaf98bea6b81a6096',
        block_height: 21937981,
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
        sender: 'fgfdg',
        evm_smart_contract_id: this.evmSmartContract.id,
        track: true,
      }),
      EvmEvent.fromJson({
        id: this.evmEvent.id,
        block_hash:
          '0x6d70a03cda3fb815b54742fbd47c6141a7e754ff4d7426f10a73644ac44411d2',
        block_height: 21937982,
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
        sender: 'fgfdg',
        evm_smart_contract_id: this.evmSmartContract.id,
        track: true,
      }),
    ];
    const mockQueryEvents: any = {
      select: () => erc721Events,
      transacting: () => mockQueryEvents,
      joinRelated: () => mockQueryEvents,
      where: () => mockQueryEvents,
      andWhere: () => mockQueryEvents,
      orderBy: () => mockQueryEvents,
      leftJoin: () => mockQueryEvents,
    };
    jest.spyOn(EvmEvent, 'query').mockImplementation(() => mockQueryEvents);
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
  }
}
