import { AfterAll, BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import HandleTransactionEVMService from '../../../../src/services/evm/handle_tx_evm.service';
import knex from '../../../../src/common/utils/db_connection';
import {
  BlockCheckpoint,
  TransactionMessage,
  EventAttribute,
  EVMTransaction,
} from '../../../../src/models';

@Describe('Test HandleTxEvm')
export default class TestHandleTxEvm {
  broker = new ServiceBroker({ logger: false });

  handleTxEvmService = this.broker.createService(
    HandleTransactionEVMService
  ) as HandleTransactionEVMService;

  @BeforeEach()
  async initSuite() {
    await this.broker.start();
    await knex.raw('TRUNCATE TABLE evm_transaction RESTART IDENTITY CASCADE');
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  @Test()
  async testJobHandler() {
    jest.spyOn(BlockCheckpoint, 'getCheckpoint').mockResolvedValue([
      100,
      101,
      BlockCheckpoint.fromJson({
        job_name: 'dfdsfgsg',
        height: 100,
      }),
    ]);
    const transactionMessages = [
      TransactionMessage.fromJson({
        tx_msg_id: 111,
        tx_id: 500285,
        index: 0,
        tx_index: 0,
        sender: 'aura1gv8zrnhs8l64q2f3qgpewtx3nsu3tfgtp7t4s7',
        type: '/ethermint.evm.v1.MsgEthereumTx',
        content: {
          data: {
            r: 'dGYeE28c2Y9TsVifIDDxvXPcTgeESq5GKYuS1QQtzhs=',
            s: 'Z6QWCPYI/+n+paOaOOxrdIXO3uxlgJmV000oyNRRypQ=',
            v: '',
            to: '0xcdADB6f169DA46D03dffAD95352F91A543C44bDC',
            gas: '250000',
            data: '7+85oQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC',
            '@type': '/ethermint.evm.v1.DynamicFeeTx',
            nonce: '5',
            value: '1777000000000000',
            accesses: [],
            chain_id: '1236',
            gas_fee_cap: '10000000',
            gas_tip_cap: '10000000',
          },
          from: '',
          hash: '0x27bb839ad2b9bd82c935844be1d57c7b3f3cfaf2038366c35ef63f8ac46c665a',
          size: 0,
          '@type': '/ethermint.evm.v1.MsgEthereumTx',
        },
        height: 19240171,
      }),
    ];
    Object.defineProperties(transactionMessages, {
      orderBy: {
        value: () => transactionMessages,
        writable: true,
      },
    });
    const eventAttrs = [
      EventAttribute.fromJson({
        composite_key: 'ethereum_tx.ethereumTxFailed',
        tx_id: 500285,
        event_id: '295013699',
        index: 6,
        key: 'ethereumTxFailed',
        value: 'execution reverted',
        block_height: 19240171,
      }),
    ];
    Object.defineProperties(eventAttrs, {
      andWhere: {
        value: () => eventAttrs,
        writable: true,
      },
    });
    const mockTransactionMessageQuery: any = {
      select: () => mockTransactionMessageQuery,
      joinRelated: () => mockTransactionMessageQuery,
      where: () => mockTransactionMessageQuery,
      andWhere: () => mockTransactionMessageQuery,
      orderBy: () => transactionMessages,
    };
    jest
      .spyOn(TransactionMessage, 'query')
      .mockImplementation(() => mockTransactionMessageQuery);
    const mockEventAttrQuery: any = {
      where: () => mockEventAttrQuery,
      andWhere: () => eventAttrs,
    };
    jest
      .spyOn(EventAttribute, 'query')
      .mockImplementation(() => mockEventAttrQuery);
    const contractAddress = '0xe1fb381d6fe4ebd25d38929fa7e4c00de2ccd2b2';
    jest
      .spyOn(this.handleTxEvmService.viemClient, 'getTransactionReceipt')
      .mockResolvedValueOnce(
        Promise.resolve({
          contractAddress,
          blockHash: '0xgfdsgfdhgdg',
          blockNumber: BigInt(0),
          from: '0x444',
          cumulativeGasUsed: BigInt(0),
          effectiveGasPrice: BigInt(0),
          gasUsed: BigInt(1000),
          logs: [],
          logsBloom: '0xdfvdsfgds',
          status: 'reverted',
          to: '0x23333',
          transactionHash: '0xdddd',
          transactionIndex: 0,
          type: 'eip1559',
        })
      );
    await this.handleTxEvmService.jobHandler();
    const result = await EVMTransaction.query().first().throwIfNotFound();
    expect(result).toMatchObject({
      height: transactionMessages[0].height,
      hash: transactionMessages[0].content.hash,
      from: '0x430e21cef03ff55029310203972cd19c3915a50b',
      value: BigInt(transactionMessages[0].content.data.value).toString(),
      tx_msg_id: transactionMessages[0].tx_msg_id,
      tx_id: transactionMessages[0].tx_id,
      index: transactionMessages[0].index,
      nonce: BigInt(transactionMessages[0].content.data.nonce).toString(),
      reason: eventAttrs[0].value,
      size: transactionMessages[0].content.size.toString(),
      status: 0,
      to: transactionMessages[0].content.data?.to
        ? transactionMessages[0].content.data.to.toLowerCase()
        : null,
    });
  }
}
