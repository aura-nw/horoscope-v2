import { AfterAll, BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import CreateEvmEventPartitionJob from '../../../../src/services/evm/job/create_evm_event_partition.service';
import { EvmEvent } from '../../../../src/models';
import config from '../../../../config.json' assert { type: 'json' };

@Describe('Test create evm event partition')
export default class CreateTableEvmEventPartitionSpec {
  broker = new ServiceBroker({ logger: false });

  createEvmEventPartitionJob?: CreateEvmEventPartitionJob;

  @BeforeEach()
  async initSuite() {
    this.createEvmEventPartitionJob = this.broker.createService(
      CreateEvmEventPartitionJob
    ) as CreateEvmEventPartitionJob;
  }

  @Test('No evm event exist on table => Dont need to create partition')
  public async test1() {
    await knex.raw(
      `TRUNCATE TABLE ${EvmEvent.tableName} RESTART IDENTITY CASCADE`
    );
    const result =
      await this.createEvmEventPartitionJob?.jobCreateEvmEventPartition();
    expect(result).toEqual(false);
  }

  @Test('Test function consider partition create base on latest evm event id')
  public async test2() {
    const mockEvmEvent = new EvmEvent();
    /**
     *@description: Failed because partition from 0 -> 100000000, id is 49999999
     * so id not reach to half of support value from partition, so we expect return null
     */
    mockEvmEvent.id = config.migrationEvmEventToPartition.step / 2 - 1;
    const result = await this.createEvmEventPartitionJob?.createPartitionName(
      mockEvmEvent
    );
    expect(result).toBe(null);

    /**
     *@description: True because partition from 0 -> 100000000, id is 49999999
     * so id reach to half of support value from partition, so we expect return partition information
     */
    const mockEvmEvent1 = new EvmEvent();
    mockEvmEvent1.id = config.migrationEvmEventToPartition.step / 2 + 1;
    const result1 =
      this.createEvmEventPartitionJob?.createPartitionName(mockEvmEvent1);
    expect(result1).toBeDefined();
  }

  @Test('Test build partition name')
  public async test3() {
    /**
     * @description: Because id not reach to half of partition will be blocked by test case above, so in this case
     * we just need to test for id reach to half of partition value
     */
    const mockEvmEvent = new EvmEvent();
    mockEvmEvent.id = config.migrationEvmEventToPartition.step / 2 + 1;
    const partitionInfo =
      await this.createEvmEventPartitionJob?.createPartitionName(mockEvmEvent);
    expect(partitionInfo).toBeDefined();

    /**
     * @description when max evm_event id reach to 850000001 then we need to create next partition
     */
    const mockEvmEvent1 = new EvmEvent();
    mockEvmEvent1.id = 850000001;
    const partitionInfo1 =
      await this.createEvmEventPartitionJob?.createPartitionName(mockEvmEvent1);
    expect(partitionInfo1?.fromEvmEventId).toEqual('900000000');
    expect(partitionInfo1?.toEvmEventId).toEqual('1000000000');
    expect(partitionInfo1?.partitionName).toEqual(
      `${EvmEvent.tableName}_partition_900000000_1000000000`
    );
  }

  @AfterAll()
  async tearDown() {
    await knex.raw(
      `TRUNCATE TABLE ${EvmEvent.tableName} RESTART IDENTITY CASCADE`
    );
  }
}
