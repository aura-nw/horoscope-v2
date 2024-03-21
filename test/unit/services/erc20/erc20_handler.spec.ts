import { fromBase64, toBase64 } from '@cosmjs/encoding';
import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { decodeAbiParameters, toHex } from 'viem';
import { EvmEvent } from '../../../../src/models';
import {
  ABI_APPROVAL_PARAMS,
  ABI_TRANSFER_PARAMS,
  Erc20Handler,
} from '../../../../src/services/evm/erc20_handler';

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
    const result = Erc20Handler.buildTransferActivity(
      EvmEvent.fromJson(evmEvent)
    );
    expect(result).toMatchObject({
      evm_event_id: evmEvent.id,
      sender: evmEvent.sender,
      action: 'transfer',
      erc20_contract_address: evmEvent.address,
      amount: (
        decodeAbiParameters(
          [ABI_TRANSFER_PARAMS.VALUE],
          toHex(toBase64(evmEvent.data)) as `0x${string}`
        )[0] as bigint
      ).toString(),
      from: decodeAbiParameters(
        [ABI_TRANSFER_PARAMS.FROM],
        evmEvent.topic1 as `0x${string}`
      )[0],
      to: decodeAbiParameters(
        [ABI_TRANSFER_PARAMS.TO],
        evmEvent.topic2 as `0x${string}`
      )[0],
      height: evmEvent.block_height,
      tx_hash: evmEvent.tx_hash,
    });
  }

  @Test('test build erc20 aproval activity')
  async testBuildErc20AprovalActivity() {
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
    const result = Erc20Handler.buildAprovalActivity(
      EvmEvent.fromJson(evmEvent)
    );
    expect(result).toMatchObject({
      evm_event_id: evmEvent.id,
      sender: evmEvent.sender,
      action: 'aproval',
      erc20_contract_address: evmEvent.address,
      amount: (
        decodeAbiParameters(
          [ABI_APPROVAL_PARAMS.VALUE],
          toHex(toBase64(evmEvent.data)) as `0x${string}`
        )[0] as bigint
      ).toString(),
      from: decodeAbiParameters(
        [ABI_APPROVAL_PARAMS.OWNER],
        evmEvent.topic1 as `0x${string}`
      )[0],
      to: decodeAbiParameters(
        [ABI_APPROVAL_PARAMS.SPENDER],
        evmEvent.topic2 as `0x${string}`
      )[0],
      height: evmEvent.block_height,
      tx_hash: evmEvent.tx_hash,
    });
  }
}
