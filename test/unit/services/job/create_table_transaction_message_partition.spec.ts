import { AfterAll, BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import CreateTransactionMessagePartitionJob from '../../../../src/services/job/create_transaction_message_partition.service';
import { TransactionMessage } from '../../../../src/models';
import config from '../../../../config.json' assert { type: 'json' };

@Describe('Test create transaction message partition')
export default class CreateTableTransactionMessagePartitionSpec {
  broker = new ServiceBroker({ logger: false });

  createTxMsgPartitionJob?: CreateTransactionMessagePartitionJob;

  @BeforeEach()
  async initSuite() {
    this.createTxMsgPartitionJob = this.broker.createService(
      CreateTransactionMessagePartitionJob
    ) as CreateTransactionMessagePartitionJob;
  }

  @Test(
    'No transaction message exist on table => Dont need to create partition'
  )
  public async test1() {
    await knex.raw(
      'TRUNCATE TABLE transaction_message RESTART IDENTITY CASCADE'
    );
    const result =
      await this.createTxMsgPartitionJob?.jobCreateTransactionMessagePartition();
    expect(result).toEqual(false);
  }

  @Test('Test function consider partition create base on latest id')
  public async test2() {
    const mockTxMsg = new TransactionMessage();
    /**
     *@description: Failed because partition from 0 -> 200000000, id is 99999999
     * so id not reach to half of support value from partition, so we expect return null
     */
    mockTxMsg.id = config.migrationTransactionMessageToPartition.step / 2 - 1;
    const result = await this.createTxMsgPartitionJob?.createPartitionName(
      mockTxMsg
    );
    expect(result).toBe(null);

    /**
     *@description: True because partition from 0 -> 200000000, id is 100000001
     * so id reach to half of support value from partition, so we expect return partition information
     */
    const mockTxMsg1 = new TransactionMessage();
    mockTxMsg1.id = config.migrationTransactionMessageToPartition.step / 2 + 1;
    const result1 =
      this.createTxMsgPartitionJob?.createPartitionName(mockTxMsg1);
    expect(result1).toBeDefined();
  }

  @Test('Test build partition name')
  public async test3() {
    /**
     * @description: Because id not reach to half of partition will be blocked by test case above, so in this case
     * we just need to test for id reach to half of partition value
     */
    const mockTxMsg = new TransactionMessage();
    mockTxMsg.id = config.migrationTransactionMessageToPartition.step / 2 + 1;
    const partitionInfo =
      await this.createTxMsgPartitionJob?.createPartitionName(mockTxMsg);
    expect(partitionInfo).toBeDefined();

    /**
     * @description when max tx_id reach to 900000001 then we need to create next partition
     */
    const mockTxMsg1 = new TransactionMessage();
    mockTxMsg1.id = 850000001;
    const partitionInfo1 =
      await this.createTxMsgPartitionJob?.createPartitionName(mockTxMsg1);
    expect(partitionInfo1?.fromTransactionMessageId).toEqual('900000000');
    expect(partitionInfo1?.toTransactionMessageId).toEqual('1000000000');
    expect(partitionInfo1?.partitionName).toEqual(
      'transaction_message_partition_900000000_1000000000'
    );
  }

  @AfterAll()
  async tearDown() {
    await knex.raw(
      'TRUNCATE TABLE transaction_message RESTART IDENTITY CASCADE'
    );
  }
}
