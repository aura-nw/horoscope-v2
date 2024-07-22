import { fromBase64 } from '@cosmjs/encoding';
import {
  AfterAll,
  BeforeAll,
  BeforeEach,
  Describe,
  Test,
} from '@jest-decorated/core';
import { Dictionary } from 'lodash';
import { ServiceBroker } from 'moleculer';
import { decodeAbiParameters, encodeAbiParameters, fromHex, toHex } from 'viem';
import config from '../../../../config.json' assert { type: 'json' };
import knex from '../../../../src/common/utils/db_connection';
import {
  Erc20Activity,
  Erc20Contract,
  Event,
  EventAttribute,
  EvmEvent,
  EVMSmartContract,
  EVMTransaction,
  Transaction,
} from '../../../../src/models';
import { AccountBalance } from '../../../../src/models/account_balance';
import { ZERO_ADDRESS } from '../../../../src/services/evm/constant';
import {
  ABI_APPROVAL_PARAMS,
  ABI_TRANSFER_PARAMS,
  ERC20_ACTION,
  Erc20Handler,
} from '../../../../src/services/evm/erc20_handler';
import { convertBech32AddressToEthAddress } from '../../../../src/services/evm/utils';

const evmTransaction = EVMTransaction.fromJson({
  id: 2931,
  hash: '0xf15467ec2a25eeef95798d93c2fe9ed8e7c891578b8e1bcc3284105849656c9d',
  height: 1,
  tx_id: 1612438,
  tx_msg_id: 4752908,
  contract_address: null,
  index: 0,
});
const evmSmartContract = EVMSmartContract.fromJson({
  id: 1,
  address: '0xde47a655a5d9904bd3f7e1a536d8323fbd99993a',
  creator: '0x5606b4eA93F696Dd82Ca983BAF5723d00729f127',
  created_height: 100,
  created_hash:
    '0x8c46cf6373f2f6e528b56becf0ce6b460b5d90cf9b0325a136b9b3a820e1e489',
  type: EVMSmartContract.TYPES.ERC20,
  code_hash: '0xdsf3335453454tsgfsdrtserf43645y4h4tAAvfgfgds',
});
const erc20Contract = Erc20Contract.fromJson({
  id: 10,
  address: evmSmartContract.address,
  decimal: '18',
  name: 'Wrapped Aura',
  symbol: 'WAURA',
  total_supply: '0',
  track: true,
  evm_smart_contract_id: evmSmartContract.id,
});
const wrapSmartContract = EVMSmartContract.fromJson({
  id: 2,
  address: config.erc20.wrapExtensionContract[0],
  creator: '0x5606b4eA93F696Dd82Ca983BAF5723d00729f127',
  created_height: 100,
  created_hash:
    '0x8c46cf6373f2f6e528b56becf0ce6b460b5d90cf9b0325a136b9b3a820e1e489',
  type: EVMSmartContract.TYPES.ERC20,
  code_hash: '0xdsf3335453454tsgfsdrtserf43645y4h4tAAvfgfgds',
});
const erc20WrapContract = Erc20Contract.fromJson({
  id: 20,
  address: wrapSmartContract.address,
  decimal: '18',
  name: 'Wrapped Aura',
  symbol: 'WAURA',
  total_supply: '0',
  track: true,
  evm_smart_contract_id: wrapSmartContract.id,
});
const erc20ModuleAccount = 'aura1glht96kr2rseywuvhhay894qw7ekuc4q3jyctl';
@Describe('Test erc20 handler')
export default class Erc20HandlerTest {
  broker = new ServiceBroker({ logger: false });

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE evm_transaction, evm_smart_contract, erc20_contract RESTART IDENTITY CASCADE'
    );
    await EVMTransaction.query().insert(evmTransaction);
    await EVMSmartContract.query().insert([
      evmSmartContract,
      wrapSmartContract,
    ]);
    await Erc20Contract.query().insert([erc20Contract, erc20WrapContract]);
    Erc20Handler.erc20ModuleAccount = erc20ModuleAccount;
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
  }

  @BeforeEach()
  async beforeEach() {
    await knex.raw(
      'TRUNCATE TABLE evm_event, transaction, event, event_attribute RESTART IDENTITY CASCADE'
    );
  }

  @Test('test build erc20 activities (transfer, approval)')
  async testBuildErc20Activities() {
    const blockHeight = 18983870;
    const from = '0x400207c680a1c5d5a86f35f97111afc00f2f1826';
    const to = '0xea780c13a5450ac7c3e6ae4b17a0445998132b15';
    const amount = '45222000';
    const evmEvents = [
      // transfer event
      EvmEvent.fromJson({
        id: 1,
        address: erc20Contract.address,
        block_hash:
          '0xed6a2d3c3ac9a2868420c4fdd67240d2d96298fc4272cd31455cd0cdaabf9093',
        block_height: blockHeight,
        data: fromHex(
          encodeAbiParameters([ABI_TRANSFER_PARAMS.VALUE], [amount]),
          'bytes'
        ),
        evm_tx_id: evmTransaction.id,
        topic0:
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        topic1: encodeAbiParameters([ABI_TRANSFER_PARAMS.FROM], [from]),
        topic2: encodeAbiParameters([ABI_TRANSFER_PARAMS.TO], [to]),
        tx_hash:
          '0x8a82a0c8848487d716f10a91f0aefb0526d35bd0f489166cc5141718a4d8aa64',
        topic3: null,
        tx_id: evmTransaction.id,
        tx_index: 0,
      }),
      // approval event
      EvmEvent.fromJson({
        id: 2,
        address: erc20Contract.address,
        block_hash:
          '0x3ad4778e1b3a03f2c4cfe51d3dd6e75ccea2cb5081cb5eab2f83f60a6960d353',
        block_height: blockHeight,
        data: fromHex(
          encodeAbiParameters([ABI_TRANSFER_PARAMS.VALUE], [amount]),
          'bytes'
        ),
        evm_tx_id: evmTransaction.id,
        topic0:
          '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
        topic1: encodeAbiParameters([ABI_TRANSFER_PARAMS.FROM], [from]),
        topic2: encodeAbiParameters([ABI_TRANSFER_PARAMS.TO], [to]),
        tx_hash:
          '0xfc1219232e1dfd380464d0ee843e0ee5b7a587521f2e02cb9957a74f7c57b05c',
        topic3: null,
        tx_id: evmTransaction.id,
        tx_index: 0,
      }),
      // deposit event but not wrap
      EvmEvent.fromJson({
        id: 3,
        address: erc20Contract.address,
        block_hash:
          '0xed6a2d3c3ac9a2868420c4fdd67240d2d96298fc4272cd31455cd0cdaabf9093',
        block_height: blockHeight,
        data: fromHex(
          encodeAbiParameters([ABI_TRANSFER_PARAMS.VALUE], [amount]),
          'bytes'
        ),
        evm_tx_id: evmTransaction.id,
        topic0:
          '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c',
        topic1: encodeAbiParameters([ABI_TRANSFER_PARAMS.TO], [to]),
        tx_hash:
          '0x8a82a0c8848487d716f10a91f0aefb0526d35bd0f489166cc5141718a4d8aa64',
        topic2: null,
        topic3: null,
        tx_id: evmTransaction.id,
        tx_index: 0,
      }),
    ];
    await EvmEvent.query().insert(evmEvents);
    await knex.transaction(async (trx) => {
      const erc20Activitites = await Erc20Handler.buildErc20Activities(
        blockHeight - 1,
        blockHeight,
        trx,
        this.broker.logger
      );
      expect(erc20Activitites.length).toEqual(evmEvents.length - 1);
      // test build transfer activity
      const transferActivity = erc20Activitites[0];
      expect(transferActivity).toMatchObject({
        action: ERC20_ACTION.TRANSFER,
        erc20_contract_address: erc20Contract.address,
        from,
        to,
        amount,
      });
      // test build approve activity
      const approvalActivity = erc20Activitites[1];
      expect(approvalActivity).toMatchObject({
        action: ERC20_ACTION.APPROVAL,
        erc20_contract_address: erc20Contract.address,
        from,
        to,
        amount,
      });
    });
  }

  @Test('test build wrap erc20 activities (deposit, withdrawl)')
  async testBuildWrapErc20Activities() {
    const blockHeight = 18983870;
    const from = '0x400207c680a1c5d5a86f35f97111afc00f2f1826';
    const to = '0xea780c13a5450ac7c3e6ae4b17a0445998132b15';
    const amount = '45222000';
    const evmEvents = [
      // deposit event
      EvmEvent.fromJson({
        id: 1,
        address: erc20WrapContract.address,
        block_hash:
          '0xed6a2d3c3ac9a2868420c4fdd67240d2d96298fc4272cd31455cd0cdaabf9093',
        block_height: blockHeight,
        data: fromHex(
          encodeAbiParameters([ABI_TRANSFER_PARAMS.VALUE], [amount]),
          'bytes'
        ),
        evm_tx_id: evmTransaction.id,
        topic0:
          '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c',
        topic1: encodeAbiParameters([ABI_TRANSFER_PARAMS.TO], [to]),
        tx_hash:
          '0x8a82a0c8848487d716f10a91f0aefb0526d35bd0f489166cc5141718a4d8aa64',
        topic2: null,
        topic3: null,
        tx_id: evmTransaction.id,
        tx_index: 0,
      }),
      // withdrawal event
      EvmEvent.fromJson({
        id: 2,
        address: erc20WrapContract.address,
        block_hash:
          '0xed6a2d3c3ac9a2868420c4fdd67240d2d96298fc4272cd31455cd0cdaabf9093',
        block_height: blockHeight,
        data: fromHex(
          encodeAbiParameters([ABI_TRANSFER_PARAMS.VALUE], [amount]),
          'bytes'
        ),
        evm_tx_id: evmTransaction.id,
        topic0:
          '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65',
        topic1: encodeAbiParameters([ABI_TRANSFER_PARAMS.FROM], [from]),
        tx_hash:
          '0x8a82a0c8848487d716f10a91f0aefb0526d35bd0f489166cc5141718a4d8aa64',
        topic2: null,
        topic3: null,
        tx_id: evmTransaction.id,
        tx_index: 0,
      }),
    ];
    await EvmEvent.query().insert(evmEvents);
    await knex.transaction(async (trx) => {
      const erc20Activitites = await Erc20Handler.buildErc20Activities(
        blockHeight - 1,
        blockHeight,
        trx,
        this.broker.logger
      );
      expect(erc20Activitites.length).toEqual(evmEvents.length);
      // test build deposit activity
      const depositActivity = erc20Activitites[0];
      expect(depositActivity).toMatchObject({
        action: ERC20_ACTION.DEPOSIT,
        erc20_contract_address: erc20WrapContract.address,
        from: ZERO_ADDRESS,
        to,
        amount,
      });
      // test build withdrawal activity
      const withdrawalActivity = erc20Activitites[1];
      expect(withdrawalActivity).toMatchObject({
        action: ERC20_ACTION.WITHDRAWAL,
        erc20_contract_address: erc20WrapContract.address,
        from,
        to: ZERO_ADDRESS,
        amount,
      });
    });
  }

  @Test('test build erc20 activities from cosmos (convertCoin, convertErc20)')
  async testBuildConvertCoinErc20Activity() {
    const blockHeight = 100;
    const from = '0x400207c680a1c5d5a86f35f97111afc00f2f1826';
    const to = '0xea780c13a5450ac7c3e6ae4b17a0445998132b15';
    const amount = '45222000';
    const transaction = Transaction.fromJson({
      code: 0,
      codespace: '',
      data: {
        linkS3:
          'https://nft.aurascan.io/rawlog/aura/auradev_1236-2/transaction/20534362/1406F9DDCE529F0E6EB32E07A88E5BC4EE220D3A2AB6D57E89DD12EB1945CC19',
      },
      fee: JSON.stringify([
        {
          denom: 'uaura',
          amount: '6141',
        },
      ]),
      gas_limit: '2456353',
      gas_used: '1775234',
      gas_wanted: '2456353',
      hash: '1406F9DDCE529F0E6EB32E07A88E5BC4EE220D3A2AB6D57E89DD12EB1945CC19',
      height: blockHeight,
      id: 505671,
      index: 0,
      memo: 'memo',
      timestamp: '2024-07-15T17:08:43.386+07:00',
      events: [
        {
          id: 2,
          tx_msg_index: 0,
          type: Event.EVENT_TYPE.CONVERT_COIN,
          source: 'TX_EVENT',
          block_height: blockHeight,
          attributes: [
            {
              block_height: blockHeight,
              index: 4,
              key: EventAttribute.ATTRIBUTE_KEY.ERC20_TOKEN,
              tx_id: 505671,
              value: erc20Contract.address,
              event_id: '1',
            },
            {
              block_height: blockHeight,
              index: 0,
              key: EventAttribute.ATTRIBUTE_KEY.SENDER,
              tx_id: 505671,
              value: erc20ModuleAccount,
              event_id: '1',
            },
            {
              block_height: blockHeight,
              index: 1,
              key: EventAttribute.ATTRIBUTE_KEY.RECEIVER,
              tx_id: 505671,
              value: to,
              event_id: '1',
            },
            {
              block_height: blockHeight,
              index: 2,
              key: EventAttribute.ATTRIBUTE_KEY.AMOUNT,
              tx_id: 505671,
              value: amount,
              event_id: '1',
            },
          ],
        },
        {
          id: 3,
          tx_msg_index: 1,
          type: Event.EVENT_TYPE.CONVERT_ERC20,
          source: 'TX_EVENT',
          block_height: blockHeight,
          attributes: [
            {
              block_height: blockHeight,
              index: 0,
              key: 'sender',
              tx_id: 505657,
              value: from,
              event_id: '1',
            },
            {
              block_height: blockHeight,
              index: 1,
              key: 'receiver',
              tx_id: 505657,
              value: erc20ModuleAccount,
              event_id: '1',
            },
            {
              block_height: blockHeight,
              index: 2,
              key: 'amount',
              tx_id: 505657,
              value: amount,
              event_id: '1',
            },
            {
              block_height: blockHeight,
              index: 4,
              key: 'erc20_token',
              tx_id: 505657,
              value: erc20Contract.address,
              event_id: '1',
            },
          ],
        },
      ],
    });
    await Transaction.query().insertGraph(transaction);
    await knex.transaction(async (trx) => {
      const erc20Activitites = await Erc20Handler.buildErc20Activities(
        blockHeight - 1,
        blockHeight,
        trx,
        this.broker.logger
      );
      // test convert coin activity
      const convertCoinActivity = erc20Activitites[0];
      expect(convertCoinActivity).toMatchObject({
        from: convertBech32AddressToEthAddress(
          config.networkPrefixAddress,
          erc20ModuleAccount
        ).toLowerCase(),
        to,
        amount,
        action: ERC20_ACTION.TRANSFER,
        erc20_contract_address: erc20Contract.address,
        cosmos_event_id: transaction.events[0].id,
      });
      // test convert erc20 activity
      const convertErc20Activity = erc20Activitites[1];
      expect(convertErc20Activity).toMatchObject({
        from,
        to: convertBech32AddressToEthAddress(
          config.networkPrefixAddress,
          erc20ModuleAccount
        ).toLowerCase(),
        amount,
        action: ERC20_ACTION.TRANSFER,
        erc20_contract_address: erc20Contract.address,
        cosmos_event_id: transaction.events[1].id,
      });
    });
  }

  @Test('test build erc20 transfer activity')
  async testBuildErc20TransferActivity() {
    const evmEvent = {
      id: 872436,
      tx_id: 9377483,
      evm_tx_id: 6789103,
      address: '0xf4dcd1ba7a2d862077a12918b9cf1889568b1fc5',
      topic0:
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      topic1:
        '0x00000000000000000000000089413d5a8601622a03fd63f8aab595a12e65b9c0',
      topic2:
        '0x0000000000000000000000004b919d8175dba25dbf733e7dcf9241ea7e51943b',
      topic3: null,
      block_height: 22024821,
      tx_hash:
        '0x1d646b55ef69dc9cf5e6b025b783c947f36d51c9b4e164895bbfe9e2af8b6e22',
      tx_index: 0,
      block_hash:
        '0x6daa455dda31eb9e09000087bee9540bee9622842d5a423baf82da5b7b534a38',
      data: fromBase64('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADVdLhb6wpEI='),
      sender: 'evmos1fwgemqt4mw39m0mn8e7ulyjpafl9r9pmzyv3hv',
    };
    const [from, to, amount] = decodeAbiParameters(
      [
        ABI_TRANSFER_PARAMS.FROM,
        ABI_TRANSFER_PARAMS.TO,
        ABI_TRANSFER_PARAMS.VALUE,
      ],
      (evmEvent.topic1 +
        evmEvent.topic2.slice(2) +
        toHex(evmEvent.data).slice(2)) as `0x${string}`
    ) as [string, string, bigint];
    const result = Erc20Handler.buildTransferActivity(
      EvmEvent.fromJson(evmEvent),
      this.broker.logger
    );
    expect(result).toMatchObject({
      evm_event_id: evmEvent.id,
      sender: evmEvent.sender,
      action: ERC20_ACTION.TRANSFER,
      erc20_contract_address: evmEvent.address,
      amount: amount.toString(),
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      height: evmEvent.block_height,
      tx_hash: evmEvent.tx_hash,
      evm_tx_id: evmEvent.evm_tx_id,
    });
  }

  @Test('test build erc20 approval activity')
  async testBuildErc20ApprovalActivity() {
    const evmEvent = {
      id: 881548,
      tx_id: 9381778,
      evm_tx_id: 6793335,
      address: '0xf4dcd1ba7a2d862077a12918b9cf1889568b1fc5',
      topic0:
        '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
      topic1:
        '0x000000000000000000000000e57c921f5f3f3a2aade9a462dab70b0cb97ded4d',
      topic2:
        '0x000000000000000000000000cbd61600b891a738150e68d5a58646321189cf6f',
      topic3: null,
      block_height: 22033598,
      tx_hash:
        '0x89dd0093c3c7633276c20be92fd5838f1eca99314a0c6375e9050e5cc82b51c3',
      tx_index: 1,
      block_hash:
        '0x692c859d6254ef6c27fc7accf1131d55351c62a1357fe261d8517e3144cfbebe',
      data: fromBase64('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='),
      sender: 'evmos1u47fy86l8uaz4t0f533d4dctpjuhmm2dh3ezg0',
    };
    const result = Erc20Handler.buildApprovalActivity(
      EvmEvent.fromJson(evmEvent),
      this.broker.logger
    );
    const [from, to, amount] = decodeAbiParameters(
      [
        ABI_APPROVAL_PARAMS.OWNER,
        ABI_APPROVAL_PARAMS.SPENDER,
        ABI_APPROVAL_PARAMS.VALUE,
      ],
      (evmEvent.topic1 +
        evmEvent.topic2.slice(2) +
        toHex(evmEvent.data).slice(2)) as `0x${string}`
    ) as [string, string, bigint];
    expect(result).toMatchObject({
      evm_event_id: evmEvent.id,
      sender: evmEvent.sender,
      action: ERC20_ACTION.APPROVAL,
      erc20_contract_address: evmEvent.address,
      amount: amount.toString(),
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      height: evmEvent.block_height,
      tx_hash: evmEvent.tx_hash,
      evm_tx_id: evmEvent.evm_tx_id,
    });
  }

  @Test('test handlerErc20Transfer')
  async testHandlerErc20Transfer() {
    const erc20Activity = Erc20Activity.fromJson({
      evm_event_id: 1,
      sender: 'dafjfjj',
      action: ERC20_ACTION.TRANSFER,
      erc20_contract_address: 'hsdbjbfbdsfc',
      amount: '12345222',
      from: 'phamphong1',
      to: 'phamphong2',
      height: 10000,
      tx_hash: 'fghkjghfdkjgbvkdfngkjdf',
      evm_tx_id: 1,
      from_account_id: 123,
      to_account_id: 234,
    });
    const [fromKey, toKey] = [
      `${erc20Activity.from_account_id}_${erc20Activity.erc20_contract_address}`,
      `${erc20Activity.to_account_id}_${erc20Activity.erc20_contract_address}`,
    ];
    const accountBalances: Dictionary<AccountBalance> = {
      [fromKey]: AccountBalance.fromJson({
        denom: erc20Activity.erc20_contract_address,
        amount: '998222',
        last_updated_height: 1,
      }),
      [toKey]: AccountBalance.fromJson({
        denom: erc20Activity.erc20_contract_address,
        amount: '1111111',
        last_updated_height: 1,
      }),
    };
    const erc20Handler = new Erc20Handler(accountBalances, []);
    erc20Handler.handlerErc20Transfer(erc20Activity);
    expect(erc20Handler.accountBalances[fromKey]).toMatchObject({
      denom: erc20Activity.erc20_contract_address,
      amount: '-11347000',
    });
    expect(erc20Handler.accountBalances[toKey]).toMatchObject({
      denom: erc20Activity.erc20_contract_address,
      amount: '13456333',
    });
  }
}
