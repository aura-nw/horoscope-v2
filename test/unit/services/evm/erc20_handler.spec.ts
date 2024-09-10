import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import _ from 'lodash';
import { ServiceBroker } from 'moleculer';
import { decodeAbiParameters, hexToBytes, toHex } from 'viem';
import knex from '../../../../src/common/utils/db_connection';
import { getViemClient } from '../../../../src/common/utils/etherjs_client';
import {
  Account,
  AccountBalance,
  Erc20Activity,
  Erc20Contract,
  EvmEvent,
  EVMSmartContract,
  EVMTransaction,
} from '../../../../src/models';
import { ABI_TRANSFER_PARAMS } from '../../../../src/services/evm/erc20_handler';
import { Erc20Reindexer } from '../../../../src/services/evm/erc20_reindex';

const accounts = [
  Account.fromJson({
    id: 116058,
    address: 'aura1az8cmnr4ppfggj0vt4llzdun0ptlkc8jxha27w',
    balances: [
      {
        denom: 'uaura',
        amount: '42981159',
      },
    ],
    code_hash: null,
    evm_address: '0xe88f8dcc7508528449ec5d7ff137937857fb60f2',
    pubkey: {},
    sequence: 11,
    account_number: 5,
    spendable_balances: [
      {
        denom: 'uaura',
        amount: '42981159',
      },
    ],
    type: '/cosmos.auth.v1beta1.BaseAccount',
    account_balances: [
      {
        denom: '0x80b5a32e4f032b2a058b4f29ec95eefeeb87adcd',
        amount: '422142',
        type: 'ERC20_TOKEN',
      },
      {
        denom: '0xde47a655a5d9904bd3f7e1a536d8323fbd99993a',
        amount: '-10000000000000000000',
        type: 'ERC20_TOKEN',
      },
    ],
  }),
  Account.fromJson({
    id: 116059,
    address: 'aura1xnjpzgtqztcy9l8vhafmr5zulfn7a8l8sjlhp3',
    balances: [
      {
        denom: 'uaura',
        amount: '32218705',
      },
    ],
    code_hash: null,
    evm_address: '0x34e411216012f042fcecbf53b1d05cfa67ee9fe7',
    pubkey: {},
    sequence: 11,
    account_number: 5,
    spendable_balances: [
      {
        denom: 'uaura',
        amount: '42981159',
      },
    ],
    type: '/cosmos.auth.v1beta1.BaseAccount',
    account_balances: [],
  }),
];
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
  activities: [
    {
      from: '0x93f8e7ec7e054b476d7de8e6bb096e56cd575beb',
      erc20_contract_address: '0xde47a655a5d9904bd3f7e1a536d8323fbd99993a',
      height: 7116660,
      sender: '0x34e411216012f042fcecbf53b1d05cfa67ee9fe7',
      to: '0x34e411216012f042fcecbf53b1d05cfa67ee9fe7',
      tx_hash:
        '0xf15467ec2a25eeef95798d93c2fe9ed8e7c891578b8e1bcc3284105849656c9d',
      action: 'transfer',
      amount: '258773093659445577552',
    },
  ],
  evm_smart_contract_id: evmSmartContract.id,
});
const evmTransaction = EVMTransaction.fromJson({
  id: 2931,
  hash: hexToBytes(
    '0xf15467ec2a25eeef95798d93c2fe9ed8e7c891578b8e1bcc3284105849656c9d'
  ),
  height: 1,
  tx_id: 1612438,
  tx_msg_id: 4752908,
  contract_address: null,
  index: 0,
});

@Describe('Test erc20 reindex')
export default class Erc20ReindexTest {
  broker = new ServiceBroker({ logger: false });

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    await knex.raw(
      'TRUNCATE TABLE evm_transaction, evm_smart_contract, erc20_contract, account, erc20_activity, account_balance, evm_event RESTART IDENTITY CASCADE'
    );
    await EVMTransaction.query().insert(evmTransaction);
    await EVMSmartContract.query().insert(evmSmartContract);
    await Erc20Contract.query().insertGraph(erc20Contract);
    await Account.query().insertGraph(accounts);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  @Test('test reindex')
  async testReindex() {
    const viemClient = getViemClient();
    jest.spyOn(viemClient, 'getBlockNumber').mockResolvedValue(BigInt(123456));
    // Instantiate Erc20Reindexer with the mock
    const reindexer = new Erc20Reindexer(viemClient, this.broker.logger);
    const event = EvmEvent.fromJson({
      id: 4227,
      topic0:
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      topic1:
        '0x000000000000000000000000e88f8dcc7508528449ec5d7ff137937857fb60f2',
      topic2:
        '0x00000000000000000000000034e411216012f042fcecbf53b1d05cfa67ee9fe7',
      topic3: null,
      tx_hash:
        '0xf15467ec2a25eeef95798d93c2fe9ed8e7c891578b8e1bcc3284105849656c9d',
      tx_index: 0,
      tx_id: 1612438,
      data: Buffer.from(
        '\\x00000000000000000000000000000000000000000000000e0732b5a508244750'
      ),
      block_height: 1,
      block_hash:
        '0x16f84b38d58b8aedbba1e108990f858b09fe8373610659d4c37a67f5c87e09e1',
      address: evmSmartContract.address,
      evm_tx_id: evmTransaction.id,
    });
    await EvmEvent.query().insert(event);
    // Call the reindex method
    await reindexer.reindex(erc20Contract.address as `0x${string}`);
    // Test phase
    const erc20Activity = await Erc20Activity.query().first().throwIfNotFound();
    const [from, to, amount] = decodeAbiParameters(
      [
        ABI_TRANSFER_PARAMS.FROM,
        ABI_TRANSFER_PARAMS.TO,
        ABI_TRANSFER_PARAMS.VALUE,
      ],
      (event.topic1 +
        event.topic2.slice(2) +
        toHex(event.data).slice(2)) as `0x${string}`
    ) as [string, string, bigint];
    // Test new activity had been inserted
    expect(erc20Activity).toMatchObject({
      action: 'transfer',
      erc20_contract_address: erc20Contract.address,
      amount: amount.toString(),
      from: from.toLowerCase(),
      to: to.toLowerCase(),
    });
    const accountBalances = _.keyBy(
      await AccountBalance.query(),
      (o) => `${o.account_id}_${o.denom}`
    );
    // from account balance had been reindexed
    expect(
      accountBalances[`${accounts[0].id}_${erc20Contract.address}`]
    ).toMatchObject({
      denom: erc20Contract.address,
      amount: `-${amount.toString()}`,
    });
    // to account balance had been reindexed
    expect(
      accountBalances[`${accounts[1].id}_${erc20Contract.address}`]
    ).toMatchObject({
      denom: erc20Contract.address,
      amount: amount.toString(),
    });
    // from account balance without erc20 had been orinal
    expect(
      accountBalances[
        `${accounts[0].id}_${accounts[0].account_balances[0].denom}`
      ]
    ).toMatchObject({
      denom: accounts[0].account_balances[0].denom,
      amount: accounts[0].account_balances[0].amount,
    });
  }
}
