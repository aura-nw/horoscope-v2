import { Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import EvmCrawlInternalTxService from '../../../../src/services/evm/evm_crawl_internal_tx.service';

@Describe('Test EvmCrawlInternalTx')
export default class TestEvmCrawlInternalTx {
  broker = new ServiceBroker({ logger: false });

  evmCrawlInternalTxService = this.broker.createService(
    EvmCrawlInternalTxService
  ) as EvmCrawlInternalTxService;

  @Test('Test buildEvmInternalTransaction normal case')
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

  @Test('Test buildEvmInternalTransaction complicated call')
  async testBuildEvmInternalTransactionComplicatedCall() {
    const result = {
      calls: [
        {
          from: '0x98605ae21dd3be686337a6d7a8f156d0d8baee92',
          gas: '0x67342',
          gasUsed: '0x5d26',
          input: '0xd0e30db0',
          output: '0x',
          to: '0xe974cc14c93fc6077b0d65f98832b846c5454a0b',
          type: 'CALL',
          value: '0x8ac7230489e80000',
        },
        {
          from: '0x98605ae21dd3be686337a6d7a8f156d0d8baee92',
          gas: '0x6166e',
          gasUsed: '0x1ec2',
          input:
            '0x23b872dd00000000000000000000000098605ae21dd3be686337a6d7a8f156d0d8baee92000000000000000000000000c7663c6a454fc9971c93235a170c8997e8c5e6610000000000000000000000000000000000000000000000008ac7230489e80000',
          output:
            '0x0000000000000000000000000000000000000000000000000000000000000001',
          to: '0xe974cc14c93fc6077b0d65f98832b846c5454a0b',
          type: 'CALL',
          value: '0x0',
        },
        {
          from: '0x98605ae21dd3be686337a6d7a8f156d0d8baee92',
          gas: '0x5f6af',
          gasUsed: '0x1be',
          input:
            '0x70a08231000000000000000000000000c7663c6a454fc9971c93235a170c8997e8c5e661',
          output:
            '0x000000000000000000000000000000000000000000000001d7d843dc3b480000',
          to: '0xe974cc14c93fc6077b0d65f98832b846c5454a0b',
          type: 'STATICCALL',
        },
        {
          from: '0x98605ae21dd3be686337a6d7a8f156d0d8baee92',
          gas: '0x5f372',
          gasUsed: '0xa43',
          input:
            '0xdd62ed3e000000000000000000000000c7663c6a454fc9971c93235a170c8997e8c5e661000000000000000000000000d1fc2d4f9984b6214d0a3778cbacbabfa5e84224',
          output:
            '0x0000000000000000000000000000000000000000000000008ac7230489e80000',
          to: '0xe974cc14c93fc6077b0d65f98832b846c5454a0b',
          type: 'STATICCALL',
        },
        {
          calls: [
            {
              from: '0x56e88b1731d55703c1f80391602297715886fa6a',
              gas: '0x5bb52',
              gasUsed: '0xab0',
              input:
                '0x37436c98000000000000000000000000c7663c6a454fc9971c93235a170c8997e8c5e66100000000000000000000000098605ae21dd3be686337a6d7a8f156d0d8baee92',
              output:
                '0x0000000000000000000000000000000000000000000000000000000000000001',
              to: '0xb28d39287ec900e0987f5dd755651de4256d0f5b',
              type: 'STATICCALL',
            },
          ],
          from: '0x98605ae21dd3be686337a6d7a8f156d0d8baee92',
          gas: '0x5de59',
          gasUsed: '0x1771',
          input:
            '0x72d27692000000000000000000000000c7663c6a454fc9971c93235a170c8997e8c5e661',
          output:
            '0x0000000000000000000000000000000000000000000000000000000000000001',
          to: '0x56e88b1731d55703c1f80391602297715886fa6a',
          type: 'STATICCALL',
        },
      ],
      from: '0xc7663c6a454fc9971c93235a170c8997e8c5e661',
      gas: '0x74994',
      gasUsed: '0x22f96',
      input:
        '0xa85d83ad000000000000000000000000c211c2cf383a38933f8352cbdd326b51b94574e6000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008ac7230489e800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      output:
        '0x000000000000000000000000000000000000000000000000000000000000000c',
      to: '0x98605ae21dd3be686337a6d7a8f156d0d8baee92',
      type: 'CALL',
      value: '0x8ac7230489e80000',
    };
    const internalTxs =
      this.evmCrawlInternalTxService.buildEvmInternalTransaction(result, 1);
    expect(internalTxs.length).toEqual(6);
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
      type: result.calls[1].type,
      from: result.calls[1].from,
      to: result.calls[1].to,
      value: parseInt(result.calls[1].value || '0', 16),
      input: result.calls[1].input,
      gas: parseInt(result.calls[1].gas, 16),
      gas_used: parseInt(result.calls[1].gasUsed, 16),
    });
    expect(internalTxs[2]).toMatchObject({
      type: result.calls[2].type,
      from: result.calls[2].from,
      to: result.calls[2].to,
      value: parseInt(result.calls[2].value || '0', 16),
      input: result.calls[2].input,
      gas: parseInt(result.calls[2].gas, 16),
      gas_used: parseInt(result.calls[2].gasUsed, 16),
    });
    expect(internalTxs[3]).toMatchObject({
      type: result.calls[3].type,
      from: result.calls[3].from,
      to: result.calls[3].to,
      value: parseInt(result.calls[3].value || '0', 16),
      input: result.calls[3].input,
      gas: parseInt(result.calls[3].gas, 16),
      gas_used: parseInt(result.calls[3].gasUsed, 16),
    });
    expect(internalTxs[4]).toMatchObject({
      type: result.calls[4].type,
      from: result.calls[4].from,
      to: result.calls[4].to,
      value: parseInt(result.calls[4].value || '0', 16),
      input: result.calls[4].input,
      gas: parseInt(result.calls[4].gas, 16),
      gas_used: parseInt(result.calls[4].gasUsed, 16),
    });
    const nestedCall = result.calls[4].calls || [];
    expect(nestedCall?.length).toEqual(1);
    expect(internalTxs[5]).toMatchObject({
      type: nestedCall[0].type,
      from: nestedCall[0].from,
      to: nestedCall[0].to,
      input: nestedCall[0].input,
      gas: parseInt(nestedCall[0].gas, 16),
      gas_used: parseInt(nestedCall[0].gasUsed, 16),
    });
  }
}
