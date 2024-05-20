import { AfterAll, BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import CreateEVMBlockPartitionJob from '../../../../src/services/evm/job/create_evm_block_partition.service';
import { EVMBlock } from '../../../../src/models';
import config from '../../../../config.json' assert { type: 'json' };

@Describe('Test create evm_block partition')
export default class CreateTableEvmBlockPartitionSpec {
  broker = new ServiceBroker({ logger: false });

  CreateEVMBlockPartitionJob?: CreateEVMBlockPartitionJob;

  @BeforeEach()
  async initSuite() {
    this.CreateEVMBlockPartitionJob = this.broker.createService(
      CreateEVMBlockPartitionJob
    ) as CreateEVMBlockPartitionJob;
  }

  @Test('No transaction exist on table => Dont need to create partition')
  public async test1() {
    await knex.raw('TRUNCATE TABLE evm_block RESTART IDENTITY CASCADE');
    const result =
      await this.CreateEVMBlockPartitionJob?.jobcreateEvmBlockToPartition();
    expect(result).toEqual(false);
  }

  @Test('Test function consider partition create base on latest height')
  public async test2() {
    const mockEvmBlock = new EVMBlock();
    /**
     *@description: Failed because partition from 0 -> 100000000, id is 49999999
     * so id not reach to half of support value from partition, so we expect return null
     */
    mockEvmBlock.height = config.createEvmBlockToPartition.step / 2 - 1;
    const result = await this.CreateEVMBlockPartitionJob?.createPartitionName(
      mockEvmBlock
    );
    expect(result).toBe(null);

    /**
     *@description: True because partition from 0 -> 100000000, id is 49999999
     * so id reach to half of support value from partition, so we expect return partition information
     */
    const mockEvmBlock1 = new EVMBlock();
    mockEvmBlock1.height = config.createEvmBlockToPartition.step / 2 + 1;
    const result1 =
      this.CreateEVMBlockPartitionJob?.createPartitionName(mockEvmBlock1);
    expect(result1).toBeDefined();
  }

  @Test('Test build partition name')
  public async test3() {
    /**
     * @description: Because id not reach to half of partition will be blocked by test case above, so in this case
     * we just need to test for id reach to half of partition value
     */
    const mockEvmBlock = new EVMBlock();
    mockEvmBlock.height = config.createEvmBlockToPartition.step / 2 + 1;
    const partitionInfo =
      await this.CreateEVMBlockPartitionJob?.createPartitionName(mockEvmBlock);
    expect(partitionInfo).toBeDefined();

    /**
     * @description when max transaction id reach to 850000001 then we need to create next partition
     */
    const mockEvmBlock1 = new EVMBlock();
    mockEvmBlock1.height = 850000001;
    const partitionInfo1 =
      await this.CreateEVMBlockPartitionJob?.createPartitionName(mockEvmBlock1);
    expect(partitionInfo1?.fromEVMBlockHeight).toEqual('900000000');
    expect(partitionInfo1?.toEVMBlockHeight).toEqual('1000000000');
    expect(partitionInfo1?.partitionName).toEqual(
      'evm_block_partition_900000000_1000000000'
    );
  }

  @AfterAll()
  async tearDown() {
    await knex.raw('TRUNCATE TABLE transaction RESTART IDENTITY CASCADE');
  }
}
