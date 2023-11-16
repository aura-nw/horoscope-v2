import { AfterAll, BeforeAll, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import { Block, BlockCheckpoint, CoinTransfer } from '../../../../src/models';
import { BULL_JOB_NAME } from '../../../../src/common';
import knex from '../../../../src/common/utils/db_connection';
import CoinTransferService from '../../../../src/services/crawl-tx/coin_transfer.service';
import CrawlTxService from '../../../../src/services/crawl-tx/crawl_tx.service';
import single_tx_coin_transfer from './single_tx_coin_transfer.json' assert { type: 'json' };
import multiple_tx_coin_transfer from './multiple_tx_coin_transfer.json' assert { type: 'json' };

@Describe('Test coin transfer')
export default class CoinTransferSpec {
  broker = new ServiceBroker({ logger: false });

  coinTransferService?: CoinTransferService;

  crawlTxService?: CrawlTxService;

  private status = {
    test: 1,
    stop: 2,
  };

  private async clearData(): Promise<void> {
    await Promise.all([
      knex.raw('TRUNCATE TABLE coin_transfer RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE block_checkpoint RESTART IDENTITY CASCADE'),
      knex.raw('TRUNCATE TABLE transaction RESTART IDENTITY CASCADE'),
    ]);
  }

  private async prepareService(status: number): Promise<void> {
    if (status === this.status.stop) {
      await Promise.all([
        this.crawlTxService?.getQueueManager().stopAll(),
        this.coinTransferService?.getQueueManager().stopAll(),
        this.coinTransferService?._stop(),
        this.crawlTxService?._stop(),
        this.broker.stop(),
      ]);
    }

    if (status === this.status.test) {
      await this.broker.start();
      this.coinTransferService = this.broker.createService(
        CoinTransferService
      ) as CoinTransferService;
      this.crawlTxService = this.broker.createService(
        CrawlTxService
      ) as CrawlTxService;
      await this.crawlTxService._start();
    }
  }

  private async insertDataForTest(txHeight: number, tx: any): Promise<void> {
    // Insert job checkpoint
    await BlockCheckpoint.query().insert([
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_COIN_TRANSFER,
        height: txHeight - 50,
      }),
      BlockCheckpoint.fromJson({
        job_name: BULL_JOB_NAME.HANDLE_TRANSACTION,
        height: txHeight,
      }),
    ]);

    // Insert block for insert transaction
    await Block.query().insert(
      Block.fromJson({
        height: txHeight,
        hash: 'data for test',
        time: '2023-04-17T03:44:41.000Z',
        proposer_address: 'proposer address',
        data: {},
      })
    );

    // Insert single coin transfer transaction and related
    const listDecodedTx = await this.crawlTxService?.decodeListRawTx([
      {
        listTx: { ...tx },
        height: txHeight,
        timestamp: '2023-04-17T03:44:41.000Z',
      },
    ]);
    if (listDecodedTx)
      await knex.transaction(async (trx) => {
        await this.crawlTxService?.insertDecodedTxAndRelated(
          listDecodedTx,
          trx
        );
      });
  }

  @BeforeAll()
  async initSuite() {
    await this.prepareService(this.status.stop);
    await this.clearData();
    await this.prepareService(this.status.test);
  }

  @Test('Test single coin transfer')
  public async testSingleCoinTransfer() {
    // Expectation data
    const txHeight = 3652723;
    const amount = '1050011';
    const receiver = 'aura15x4v36r6rl73nhn9h0954mwp42sawrc25f0rnx';
    const sender = 'aura1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8ufn7tx';

    // Prepare data test and job to handle testing data
    await this.insertDataForTest(txHeight, single_tx_coin_transfer);
    await this.coinTransferService?.jobHandleTxCoinTransfer();

    // Validate
    const coinTransfer = await CoinTransfer.query().where(
      'block_height',
      txHeight
    );
    // Test determine single coin transfer
    expect(coinTransfer.length).toEqual(1);
    // Test value
    expect(coinTransfer[0].from).toEqual(sender);
    expect(coinTransfer[0].to).toEqual(receiver);
    expect(coinTransfer[0].amount).toEqual(amount);
  }

  @Test('Test multi coin transfer')
  public async testMultiCoinTransfer() {
    // Expectation data
    const txHeight = 3657660;
    const amounts = [
      '6279579',
      '9419368',
      '3601633',
      '2330468',
      '1412405',
      '1412405',
      '2683570',
      '706202',
      '706202',
      '706202',
      '282481',
      '282481',
    ];
    const sender = 'aura15pzl0s6ym85qx4yeq29rflp702wtx3dnsdg8vr';
    const receivers = [
      'aura1ewn73qp0aqrtya38p0nv5c2xsshdea7a7u3jzn',
      'aura1c03jkal0xplar2p7ndshxeqrh9kw4m6unncwsh',
      'aura1ytem9skzmq7n7tlfcqjw6wqfgd587cn3q80hxq',
      'aura10f4hqk4svs0ry0twd0fc2swf2yqcpqn0x72zs4',
      'aura12tdulmvjmsmpaqrpshz0emu0h9sqz5x5lj0qx8',
      'aura1ate5nqvum46uk2k3ta27e7yr3fgskqllnjwnm0',
      'aura1f6s4550dzyu0yzp7q2acn47mp5u25k0xzvypc6',
      'aura16n5we9kd3ewdp8ll0fgk8h2qnjzwtwz9e56vxs',
      'aura1c03jkal0xplar2p7ndshxeqrh9kw4m6unncwsh',
      'aura1mxpyg8u68k6a8wdu3hs5whcpw9q285pcnlez66',
      'aura1jjvfnekyy78n7xcvhfdqymtmsyg0yzt4ejtmkq',
      'aura1r5h46t8crr7ur99tg9x483n3t8es5gwp0m733h',
    ];

    // Prepare data and run job
    await this.clearData();
    await this.insertDataForTest(txHeight, multiple_tx_coin_transfer);
    await this.coinTransferService?.jobHandleTxCoinTransfer();

    // Validate
    const coinTransfers = await CoinTransfer.query().where(
      'block_height',
      txHeight
    );

    expect(coinTransfers.length).toEqual(12);

    for (let i = 0; i < coinTransfers.length; i += 1) {
      expect(coinTransfers[i].from).toEqual(sender);
      expect(coinTransfers[i].to).toEqual(receivers[i]);
      expect(coinTransfers[i].amount).toEqual(amounts[i]);
    }
  }

  @AfterAll()
  async tearDown() {
    await this.clearData();
    await this.prepareService(this.status.stop);
  }
}
