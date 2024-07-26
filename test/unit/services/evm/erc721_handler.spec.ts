import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import {
  Block,
  EVMSmartContract,
  EVMTransaction,
  Erc721Activity,
  Erc721Contract,
  EvmEvent,
} from '../../../../src/models';
import {
  ERC721_ACTION,
  Erc721Handler,
} from '../../../../src/services/evm/erc721_handler';

@Describe('Test erc721 handler')
export default class Erc721HandlerTest {
  broker = new ServiceBroker({ logger: false });

  evmSmartContract = EVMSmartContract.fromJson({
    id: 1,
    address: '0xE974cC14c93FC6077B0d65F98832B846C5454A0B',
    creator: '0x5606b4eA93F696Dd82Ca983BAF5723d00729f127',
    created_height: 100,
    created_hash:
      '0x8c46cf6373f2f6e528b56becf0ce6b460b5d90cf9b0325a136b9b3a820e1e489',
    code_hash: '0xdsf3335453454tsgfsdrtserf43645y4h4tAAvfgfgds',
    type: EVMSmartContract.TYPES.ERC721,
  });

  evmSmartContract2 = EVMSmartContract.fromJson({
    id: 2,
    address: '0x3CB367e7C920Ff15879Bd4CBd708b8c60eB0f537',
    creator: '0xa9497CC4F95773A744D408b54dAC724626ee31d2',
    created_height: 100,
    created_hash:
      '0x5bca9ee42c4c32941c58f2a510dae5ff5c6ed848d9a396a8e9e146a166b3a3fc',
    code_hash: '0xdfskjgdsgfgweruwie4535t3tu34tjkewtgjwe',
    type: EVMSmartContract.TYPES.ERC721,
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

  erc721Contract1 = Erc721Contract.fromJson({
    evm_smart_contract_id: this.evmSmartContract.id,
    id: 123,
    track: true,
    address: this.evmSmartContract.address,
  });

  erc721Contract2 = Erc721Contract.fromJson({
    evm_smart_contract_id: this.evmSmartContract2.id,
    id: 1234,
    track: true,
    address: this.evmSmartContract2.address,
  });

  @BeforeAll()
  async initSuite() {
    await knex.raw(
      'TRUNCATE TABLE erc721_contract, account, evm_smart_contract, evm_event, evm_transaction RESTART IDENTITY CASCADE'
    );
    await EVMSmartContract.query().insert([
      this.evmSmartContract,
      this.evmSmartContract2,
    ]);
    await Erc721Contract.query().insert([
      this.erc721Contract1,
      this.erc721Contract2,
    ]);
    await EVMTransaction.query().insert(this.evmTx);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  /**
   * @description test getErc721Activities function
   * @input evm events in range blocks
   * @result build erc721Activities from those evm events
   */
  @Test('test getErc721Activities')
  async testGetErc721Activities() {
    await knex.transaction(async (trx) => {
      const erc721Events = [
        EvmEvent.fromJson({
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
        }),
        EvmEvent.fromJson({
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
        }),
        EvmEvent.fromJson({
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
          address: this.evmSmartContract2.address,
          evm_tx_id: this.evmTx.id,
          tx_id: 1234,
          tx_hash: this.evmTx.hash,
          tx_index: 1,
        }),
        EvmEvent.fromJson({
          block_hash:
            '0x6d70a03cda3fb815b54742fbd47c6141a7e754ff4d7426f10a73644ac44411d2',
          block_height: 21937982,
          data: null,
          topic0:
            '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31',
          topic1:
            '0x0000000000000000000000001317df02a4e712265f5376a9d34156f73ebad640',
          topic2:
            '0x000000000000000000000000e39633931ec4a1841e438b15005a6f141d30789e',
          topic3: null,
          address: this.evmSmartContract.address,
          evm_tx_id: this.evmTx.id,
          tx_id: 1234,
          tx_hash: this.evmTx.hash,
          tx_index: 1,
        }),
      ];
      await EvmEvent.query().insert(erc721Events).transacting(trx);
      const erc721Activities = await Erc721Handler.getErc721Activities(
        21937979,
        21937985,
        trx,
        this.broker.logger
      );
      expect(erc721Activities[0]).toMatchObject({
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: this.evmSmartContract.address,
        from: '0x0000000000000000000000000000000000000000',
        to: '0x1317df02a4e712265f5376a9d34156f73ebad640',
      });
      expect(erc721Activities[1]).toMatchObject({
        action: ERC721_ACTION.APPROVAL,
        erc721_contract_address: this.evmSmartContract.address,
        from: '0x1317df02a4e712265f5376a9d34156f73ebad640',
        to: '0xa3b6d252c1df2ce88f01fdb75b5479bcdc8f5007',
      });
      expect(erc721Activities[2]).toMatchObject({
        action: ERC721_ACTION.APPROVAL,
        erc721_contract_address: this.evmSmartContract2.address,
        from: '0x1317df02a4e712265f5376a9d34156f73ebad640',
        to: '0xa3b6d252c1df2ce88f01fdb75b5479bcdc8f5007',
      });
      expect(erc721Activities[3]).toMatchObject({
        action: ERC721_ACTION.APPROVAL_FOR_ALL,
        erc721_contract_address: this.evmSmartContract.address,
        from: '0x1317df02a4e712265f5376a9d34156f73ebad640',
        to: '0xe39633931ec4a1841e438b15005a6f141d30789e',
      });
      // get a contract's activities
      const erc721ActivitiesByContract =
        await Erc721Handler.getErc721Activities(
          21937979,
          21937985,
          trx,
          this.broker.logger,
          [this.evmSmartContract2.address]
        );
      expect(erc721ActivitiesByContract[0]).toMatchObject({
        action: ERC721_ACTION.APPROVAL,
        erc721_contract_address: this.evmSmartContract2.address,
        from: '0x1317df02a4e712265f5376a9d34156f73ebad640',
        to: '0xa3b6d252c1df2ce88f01fdb75b5479bcdc8f5007',
      });
      await trx.rollback();
    });
  }

  /**
   * @description test calErc721Stats function
   * @input erc721Activities list
   * @result statistic from those erc721Activities
   */
  @Test('test calErc721Stats')
  async testCalErc721Stats() {
    const evmEvent = EvmEvent.fromJson({
      id: 888,
      tx_id: 1234,
      evm_tx_id: this.evmTx.id,
      tx_hash: '',
      address: '',
      block_height: 1,
      block_hash: '',
      tx_index: 1,
    });
    await EvmEvent.query().insert(evmEvent);
    const mockQueryBlocks: any = {
      limit: () => [{ height: 10001 }],
      orderBy: () => mockQueryBlocks,
      select: () => mockQueryBlocks,
      where: () => mockQueryBlocks,
    };
    jest.spyOn(Block, 'query').mockImplementation(() => mockQueryBlocks);
    const erc721Activities = [
      {
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: this.evmSmartContract.address,
        height: 10000,
        evm_event_id: evmEvent.id,
      },
      {
        action: ERC721_ACTION.APPROVAL,
        erc721_contract_address: this.evmSmartContract.address,
        height: 10000,
        evm_event_id: evmEvent.id,
      },
      {
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: this.evmSmartContract.address,
        height: 10001,
        evm_event_id: evmEvent.id,
      },
      {
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: this.evmSmartContract.address,
        height: 10001,
        evm_event_id: evmEvent.id,
      },
      {
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: this.evmSmartContract.address,
        height: 10001,
        evm_event_id: evmEvent.id,
      },
      {
        erc721_contract_address: this.evmSmartContract.address,
        height: 10001,
        evm_event_id: evmEvent.id,
      },
    ];
    await Erc721Activity.query().insert(
      erc721Activities.map((e) => Erc721Activity.fromJson(e))
    );
    const result = await Erc721Handler.calErc721Stats();
    expect(result[0]).toMatchObject({
      total_activity: '6',
      transfer_24h: '3',
      erc721_contract_id: this.erc721Contract1.id,
    });
  }
}