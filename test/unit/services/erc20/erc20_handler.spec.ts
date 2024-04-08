import { fromBase64 } from '@cosmjs/encoding';
import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { decodeAbiParameters, toHex } from 'viem';
import { Dictionary } from 'lodash';
import { Erc20Activity, EvmEvent } from '../../../../src/models';
import {
  ABI_APPROVAL_PARAMS,
  ABI_TRANSFER_PARAMS,
  ERC20_ACTION,
  Erc20Handler,
} from '../../../../src/services/evm/erc20_handler';
import { AccountBalance } from '../../../../src/models/account_balance';

@Describe('Test erc20 handler')
export default class Erc20HandlerTest {
  broker = new ServiceBroker({ logger: false });

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
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
      EvmEvent.fromJson(evmEvent)
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
      EvmEvent.fromJson(evmEvent)
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
