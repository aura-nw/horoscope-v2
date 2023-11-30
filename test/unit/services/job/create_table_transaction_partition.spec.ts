import { AfterAll, BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import CreateTransactionPartitionJob from '../../../../src/services/job/create_transaction_partition.service';
import { Transaction } from '../../../../src/models';
import config from '../../../../config.json' assert { type: 'json' };

@Describe('Test create transaction partition')
export default class CreateTableTransactionPartitionSpec {
  broker = new ServiceBroker({ logger: false });

  createTransactionPartitionJob?: CreateTransactionPartitionJob;

  @BeforeEach()
  async initSuite() {
    this.createTransactionPartitionJob = this.broker.createService(
      CreateTransactionPartitionJob
    ) as CreateTransactionPartitionJob;
  }

  @Test('No transaction exist on table => Dont need to create partition')
  public async test1() {
    await knex.raw('TRUNCATE TABLE transaction RESTART IDENTITY CASCADE');
    const result =
      await this.createTransactionPartitionJob?.jobCreateTransactionPartition();
    expect(result).toEqual(false);
  }

  @Test('Test function consider partition create base on latest transaction id')
  public async test2() {
    const mockTransaction = new Transaction();
    /**
     *@description: Failed because partition from 0 -> 100000000, id is 49999999
     * so id not reach to half of support value from partition, so we expect return null
     */
    mockTransaction.id = config.migrationTransactionToPartition.step / 2 - 1;
    const result =
      await this.createTransactionPartitionJob?.createPartitionName(
        mockTransaction
      );
    expect(result).toBe(null);

    /**
     *@description: True because partition from 0 -> 100000000, id is 49999999
     * so id reach to half of support value from partition, so we expect return partition information
     */
    const mockTransaction1 = new Transaction();
    mockTransaction1.id = config.migrationTransactionToPartition.step / 2 + 1;
    const result1 =
      this.createTransactionPartitionJob?.createPartitionName(mockTransaction1);
    expect(result1).toBeDefined();
  }

  @Test('Test build partition name')
  public async test3() {
    /**
     * @description: Because id not reach to half of partition will be blocked by test case above, so in this case
     * we just need to test for id reach to half of partition value
     */
    const mockTransaction = new Transaction();
    mockTransaction.id = config.migrationTransactionToPartition.step / 2 + 1;
    const partitionInfo =
      await this.createTransactionPartitionJob?.createPartitionName(
        mockTransaction
      );
    expect(partitionInfo).toBeDefined();

    /**
     * @description when max transaction id reach to 850000001 then we need to create next partition
     */
    const mockTransaction1 = new Transaction();
    mockTransaction1.id = 850000001;
    const partitionInfo1 =
      await this.createTransactionPartitionJob?.createPartitionName(
        mockTransaction1
      );
    expect(partitionInfo1?.fromTransactionId).toEqual('900000000');
    expect(partitionInfo1?.toTransactionId).toEqual('1000000000');
    expect(partitionInfo1?.partitionName).toEqual(
      'transaction_partition_900000000_1000000000'
    );
  }

  @Test('Test create partition on database')
  public async test4() {
    const mockTransaction = new Transaction();
    mockTransaction.id = 850000001;
    const partitionInfo =
      await this.createTransactionPartitionJob?.createPartitionName(
        mockTransaction
      );
    if (partitionInfo) {
      await this.createTransactionPartitionJob?.createPartitionByPartitionInfo(
        partitionInfo
      );
    }

    /**
     * @description partition now created so isCreated now will be false because partition already exist
     */
    const checkAgainPartitionInfo =
      await this.createTransactionPartitionJob?.createPartitionName(
        mockTransaction
      );
    expect(checkAgainPartitionInfo).toEqual(null);
    await knex.raw(`DROP TABLE ${partitionInfo?.partitionName} CASCADE`);
  }

  @AfterAll()
  async tearDown() {
    await knex.raw('TRUNCATE TABLE transaction RESTART IDENTITY CASCADE');
  }
}
