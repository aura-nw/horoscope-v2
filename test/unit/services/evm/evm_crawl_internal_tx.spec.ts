import { Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import EvmCrawlInternalTxService from '../../../../src/services/evm/evm_crawl_internal_tx.service';

@Describe('Test EvmCrawlInternalTx')
export default class TestEvmCrawlInternalTx {
  broker = new ServiceBroker({ logger: false });

  evmCrawlInternalTxService = this.broker.createService(
    EvmCrawlInternalTxService
  ) as EvmCrawlInternalTxService;

  /**
   * @description test buildEvmInternalTransaction function
   * @input result from eth_debugTracecall
   * @result build evm internal transaction
   */
  @Test('Test buildEvmInternalTransaction')
  async testBuildEvmInternalTransaction() {
    const result = {
      calls: [
        {
          from: '0x164c18f0e1863cd07931dfc87e41c95cea70a09b',
          gas: '0x0',
          gasUsed: '0x0',
          input: '0x',
          output: '0x',
          to: '0xe1fb381d6fe4ebd25d38929fa7e4c00de2ccd2b2',
          type: 'SELFDESTRUCT',
          value: '0x0',
        },
        {
          from: '0xb601891baa0877b1dd7b1cf56e09437ba4f9312d',
          gas: '0xca58d',
          gasUsed: '0xb9e',
          input:
            '0x70a08231000000000000000000000000b601891baa0877b1dd7b1cf56e09437ba4f9312d',
          output:
            '0x00000000000000000000000000000000000000000000000000000003196cbce4',
          to: '0x36572d4a569316f9841f8094d9bc343f18f5659a',
          type: 'STATICCALL',
        },
      ],
      from: '0x3e665acfe64628774d3ba8e589fa8683ed8706c9',
      gas: '0x3e97',
      gasUsed: '0x2672',
      input: '0x9e5faafc',
      output: '0x',
      to: '0x164c18f0e1863cd07931dfc87e41c95cea70a09b',
      type: 'CALL',
      value: '0x0',
    };
    const internalTxs =
      this.evmCrawlInternalTxService.buildEvmInternalTransaction(result, 1);
    expect(internalTxs.length).toEqual(2);
    expect(internalTxs[0]).toMatchObject({
      evm_tx_id: '1',
      type: result.calls[0].type,
      from: result.calls[0].from,
      to: result.calls[0].to,
      value: parseInt(result.calls[0].value || '0', 16),
      input: result.calls[0].input,
      gas: parseInt(result.calls[0].gas, 16),
      gas_used: parseInt(result.calls[0].gasUsed, 16),
    });
    expect(internalTxs[1]).toMatchObject({
      evm_tx_id: '1',
      type: result.calls[1].type,
      from: result.calls[1].from,
      to: result.calls[1].to,
      value: parseInt(result.calls[1].value || '0', 16),
      input: result.calls[1].input,
      gas: parseInt(result.calls[1].gas, 16),
      gas_used: parseInt(result.calls[1].gasUsed, 16),
    });
  }
}
