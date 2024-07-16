import {
  AfterAll,
  BeforeAll,
  BeforeEach,
  Describe,
  Test,
} from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import HandleTransactionEVMService from '../../../../src/services/evm/handle_tx_evm.service';
import knex from '../../../../src/common/utils/db_connection';
import {
  BlockCheckpoint,
  TransactionMessage,
  EventAttribute,
  EVMTransaction,
  Transaction,
} from '../../../../src/models';
import { BULL_JOB_NAME as COSMOS_BULL_JOB_NAME } from '../../../../src/common/constant';
import { BULL_JOB_NAME } from '../../../../src/services/evm/constant';

@Describe('Test HandleTxEvm')
export default class TestHandleTxEvm {
  broker = new ServiceBroker({ logger: false });

  handleTxEvmService = this.broker.createService(
    HandleTransactionEVMService
  ) as HandleTransactionEVMService;

  blockCheckpoints = [
    BlockCheckpoint.fromJson({
      job_name: BULL_JOB_NAME.HANDLE_TRANSACTION_EVM,
      height: 100,
    }),
    BlockCheckpoint.fromJson({
      job_name: COSMOS_BULL_JOB_NAME.HANDLE_TRANSACTION,
      height: 1000,
    }),
  ];

  transactions = [
    Transaction.fromJson({
      id: 500285,
      fee: {
        denom: 'aaura',
        amount: '2500000000000',
      },
      gas_limit: '250000',
      gas_used: '125000',
      gas_wanted: '250000',
      hash: '040FE6605E6E8BD0C49788DB608B6AEF5F29D4B9B37256A9E00F7CD31D603CF5',
      height: this.blockCheckpoints[0].height + 1,
      index: 0,
      memo: '',
      timestamp: '2024-04-25T14:12:43.125+07:00',
      data: {
        linkS3:
          'https://nft.aurascan.io/rawlog/aura/auradev_1236-2/transaction/19240171/040FE6605E6E8BD0C49788DB608B6AEF5F29D4B9B37256A9E00F7CD31D603CF5',
      },
      codespace: '',
      code: 0,
    }),
  ];

  @BeforeAll()
  async initSuite() {
    await this.broker.start();
    await knex.raw('TRUNCATE TABLE transaction RESTART IDENTITY CASCADE');
    await Transaction.query().insert(this.transactions);
  }

  @BeforeEach()
  async beforeEach() {
    await knex.raw(
      'TRUNCATE TABLE evm_transaction, block_checkpoint, transaction_message, event_attribute RESTART IDENTITY CASCADE'
    );
    await BlockCheckpoint.query().insert(this.blockCheckpoints);
  }

  @AfterAll()
  async tearDown() {
    await this.broker.stop();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  @Test('Test HandleTxEvm service with tx success')
  async testJobHandler() {
    const transactionMessages = [
      TransactionMessage.fromJson({
        id: 1,
        tx_id: this.transactions[0].id,
        index: 0,
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
      }),
    ];
    await TransactionMessage.query().insert(transactionMessages);
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
      height: this.transactions[0].height,
      hash: transactionMessages[0].content.hash,
      from: '0x430e21cef03ff55029310203972cd19c3915a50b',
      value: BigInt(transactionMessages[0].content.data.value).toString(),
      tx_msg_id: transactionMessages[0].id,
      tx_id: transactionMessages[0].tx_id,
      index: transactionMessages[0].index,
      nonce: BigInt(transactionMessages[0].content.data.nonce).toString(),
      reason: null,
      size: transactionMessages[0].content.size.toString(),
      status: 1,
      to: transactionMessages[0].content.data?.to
        ? transactionMessages[0].content.data.to.toLowerCase()
        : null,
    });
  }

  @Test('Test HandleTxEvm service with tx fail')
  async testJobHandlerWithTxFail() {
    const transactionMessages = [
      TransactionMessage.fromJson({
        id: 1,
        tx_id: this.transactions[0].id,
        index: 0,
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
      }),
    ];
    await TransactionMessage.query().insert(transactionMessages);
    const eventAttrs = [
      EventAttribute.fromJson({
        composite_key: 'ethereum_tx.ethereumTxFailed',
        tx_id: this.transactions[0].id,
        event_id: '295013699',
        index: 6,
        key: 'ethereumTxFailed',
        value: 'execution reverted',
        block_height: this.blockCheckpoints[0].height + 1,
      }),
    ];
    await EventAttribute.query().insert(eventAttrs);
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
      height: this.transactions[0].height,
      hash: transactionMessages[0].content.hash,
      from: '0x430e21cef03ff55029310203972cd19c3915a50b',
      value: BigInt(transactionMessages[0].content.data.value).toString(),
      tx_msg_id: transactionMessages[0].id,
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
