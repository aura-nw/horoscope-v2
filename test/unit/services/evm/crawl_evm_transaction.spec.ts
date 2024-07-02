import { AfterAll, BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { TransactionReceipt } from 'viem';
import CrawlEvmTransactionService from '../../../../src/services/evm/crawl_evm_transaction.service';

@Describe('Test crawl evm transaction')
export default class CrawlEVMTransactionTest {
  private broker = new ServiceBroker({ logger: false });

  private crawlEvmTxService!: CrawlEvmTransactionService;

  @BeforeEach()
  async setUp() {
    this.crawlEvmTxService = this.broker.createService(
      CrawlEvmTransactionService
    ) as CrawlEvmTransactionService;
  }

  @AfterAll()
  async tearDown() {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  @Test('Test set timestamp tx by getEVMTxsFromBlocks')
  async testGetEVMTxsFromBlocks() {
    const evmBlock = {
      height: 6934605,
      tx_count: 1,
      timestamp: new Date('2024-07-02 12:03:17+07'),
      difficulty: '0',
      extra_data: '0x',
      gas_limit: '30000000',
      hash: '0x1384e6013e77278ffb0d10eba6d7b2c8400f7d21f3f80083167f0234d6031d41',
      miner: '0x4200000000000000000000000000000000000011',
      transactions: [
        {
          r: '0x0',
          s: '0x0',
          v: '0',
          to: '0x4200000000000000000000000000000000000015',
          gas: '1000000',
          from: '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001',
          hash: '0x035e40976d79376eee54a216f040275c185a9349722397cff31123e7767a717b',
          mint: '0x0',
          input:
            '0x440a5e2000010b3000000000000000000000000100000000668389d30000000001347b28000000000000000000000000000000000000000000000000000000006d91d4ab00000000000000000000000000000000000000000000000000000000000000034fee93c1c1abbb155694e790e75c133286c6099e79aa2bd028e2a52a09af87570000000000000000000000006079e9c37b87fe06d0bde2431a0fa309826c9b67',
          nonce: 6934605,
          value: '0',
          typeHex: '0x7e',
          yParity: 0,
          gasPrice: '0',
          blockHash:
            '0x1384e6013e77278ffb0d10eba6d7b2c8400f7d21f3f80083167f0234d6031d41',
          sourceHash:
            '0x1f422f3e8cf4b35f88a89d18c058bd7fba86b9a3815cd8603962b274eebafa5e',
          blockNumber: '6934605',
          transactionIndex: 0,
          depositReceiptVersion: '0x1',
        },
      ],
    };
    const mockTxReceipt: TransactionReceipt[] = [
      {
        blockHash:
          '0x1384e6013e77278ffb0d10eba6d7b2c8400f7d21f3f80083167f0234d6031d41',
        blockNumber: BigInt(6934605),
        contractAddress: null,
        cumulativeGasUsed: BigInt(43815),
        effectiveGasPrice: BigInt(0),
        from: '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001',
        gasUsed: BigInt(43815),
        logs: [],
        logsBloom:
          '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        status: 'success',
        to: '0x4200000000000000000000000000000000000015',
        transactionHash:
          '0x035e40976d79376eee54a216f040275c185a9349722397cff31123e7767a717b',
        transactionIndex: 0,
        type: '0x7e',
      },
    ];
    this.crawlEvmTxService.getListTxReceipt = jest.fn(() =>
      Promise.resolve(mockTxReceipt)
    );
    const { evmTxs } =
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await this.crawlEvmTxService.getEVMTxsFromBlocks([evmBlock]);
    expect(evmTxs[0].timestamp).toEqual(evmBlock.timestamp);
  }
}
