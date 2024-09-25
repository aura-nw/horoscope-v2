import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import config from '../../../../config.json' assert { type: 'json' };
import knex from '../../../../src/common/utils/db_connection';
import {
  Block,
  EVMBlock,
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
    from: '0x38828FA9766dE6eb49011fCC970ed1beFE15974a',
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
        this.evmTx.height - 1,
        this.evmTx.height,
        this.broker.logger,
        undefined,
        trx
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
          this.evmTx.height - 1,
          this.evmTx.height,
          this.broker.logger,
          [this.evmSmartContract2.address],
          trx
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

  @Test('test process')
  async testProcess() {
    const totalTransfer = 5;
    const holders = [
      '0x38828FA9766dE6eb49011fCC970ed1beFE15974a',
      '0x27CF763feEE58f14C2c69663EA8De784FCF2Dbbb',
      '0xE1dbb634e2aefbe63085CB0b60f4155f9ABCa48f',
    ];
    const initErc721Contract = Erc721Contract.fromJson({
      evm_smart_contract_id: 1,
      address: '0x4c5f56a2FF75a8617337E33f75EB459Db422916F',
      symbol: 'ITCIPA',
      name: 'Iliad Testnet Commemorative IP Asset',
      track: true,
      last_updated_height: 0,
      total_supply: '3',
      total_actions: {
        [ERC721_ACTION.TRANSFER]: totalTransfer,
        [ERC721_ACTION.APPROVAL]: 1,
        [ERC721_ACTION.APPROVAL_FOR_ALL]: 2,
      },
    });
    const initErc721Tokens = {};
    const initErc721HolderStats = {};
    const erc721Activities = [
      // mint token 0 to holder0
      Erc721Activity.fromJson({
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: initErc721Contract.address,
        from: '0x0000000000000000000000000000000000000000',
        to: holders[0],
        token_id: '0',
        height: 1,
        evm_event_id: 1,
      }),
      // mint token 1 to holder0
      Erc721Activity.fromJson({
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: initErc721Contract.address,
        from: '0x0000000000000000000000000000000000000000',
        to: holders[0],
        token_id: '1',
        height: 1,
        evm_event_id: 1,
      }),
      // mint token 2 to holder1
      Erc721Activity.fromJson({
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: initErc721Contract.address,
        from: '0x0000000000000000000000000000000000000000',
        to: holders[1],
        token_id: '2',
        height: 2,
        evm_event_id: 1,
      }),
      // mint token 3 to holder0
      Erc721Activity.fromJson({
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: initErc721Contract.address,
        from: '0x0000000000000000000000000000000000000000',
        to: holders[0],
        token_id: '3',
        height: 3,
        evm_event_id: 1,
      }),
      // transfer token 0 from holder0 to holder2
      Erc721Activity.fromJson({
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: initErc721Contract.address,
        from: holders[0],
        to: holders[2],
        token_id: '0',
        height: 4,
        evm_event_id: 1,
      }),
      // transfer token 1 from holder0 to holder1
      Erc721Activity.fromJson({
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: initErc721Contract.address,
        from: holders[0],
        to: holders[1],
        token_id: '1',
        height: 5,
        evm_event_id: 1,
      }),
      // burn token 3
      Erc721Activity.fromJson({
        action: ERC721_ACTION.TRANSFER,
        erc721_contract_address: initErc721Contract.address,
        from: holders[0],
        to: '0x0000000000000000000000000000000000000000',
        token_id: '3',
        height: 6,
        evm_event_id: 1,
      }),
    ];
    const erc721Handler = new Erc721Handler(
      { [initErc721Contract.address]: initErc721Contract },
      initErc721Tokens,
      erc721Activities,
      initErc721HolderStats
    );
    erc721Handler.process();
    const updatedErc721Contract =
      erc721Handler.erc721Contracts[initErc721Contract.address];

    // check total supply
    expect(updatedErc721Contract.total_supply).toEqual('6');
    // check total actions
    expect(updatedErc721Contract.total_actions).toEqual({
      [ERC721_ACTION.TRANSFER]: totalTransfer + erc721Activities.length,
      [ERC721_ACTION.APPROVAL]:
        initErc721Contract.total_actions[ERC721_ACTION.APPROVAL],
      [ERC721_ACTION.APPROVAL_FOR_ALL]:
        initErc721Contract.total_actions[ERC721_ACTION.APPROVAL_FOR_ALL],
    });
    // check new owner for each token
    const updatedTokens = erc721Handler.erc721Tokens;
    expect(updatedTokens[`${initErc721Contract.address}_0`].owner).toEqual(
      holders[2]
    );
    expect(updatedTokens[`${initErc721Contract.address}_1`].owner).toEqual(
      holders[1]
    );
    expect(updatedTokens[`${initErc721Contract.address}_2`].owner).toEqual(
      holders[1]
    );
    const updatedErc721HolderStats = erc721Handler.erc721HolderStats;
    expect(
      updatedErc721HolderStats[`${initErc721Contract.address}_${holders[0]}`]
    ).toMatchObject({
      count: '0',
      last_updated_height: erc721Activities[6].height,
    });
    expect(
      updatedErc721HolderStats[`${initErc721Contract.address}_${holders[1]}`]
    ).toMatchObject({
      count: '2',
      last_updated_height: erc721Activities[5].height,
    });
    expect(
      updatedErc721HolderStats[`${initErc721Contract.address}_${holders[2]}`]
    ).toMatchObject({
      count: '1',
      last_updated_height: erc721Activities[4].height,
    });
    expect(
      updatedErc721HolderStats[
        `${initErc721Contract.address}_0x0000000000000000000000000000000000000000`
      ]
    ).toMatchObject({
      count: '-3',
      last_updated_height: erc721Activities[6].height,
    });
  }

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
    if (!config.evmOnly) {
      jest.spyOn(Block, 'query').mockImplementation(() => mockQueryBlocks);
    } else {
      jest.spyOn(EVMBlock, 'query').mockImplementation(() => mockQueryBlocks);
    }
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
