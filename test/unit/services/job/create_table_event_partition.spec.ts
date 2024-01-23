import {
  AfterAll,
  BeforeAll,
  BeforeEach,
  Describe,
  Test,
} from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import CreateEventPartitionJob from '../../../../src/services/job/create_event_partition.service';
import { Event } from '../../../../src/models';
import config from '../../../../config.json' assert { type: 'json' };

@Describe('Test create event partition')
export default class CreateTableEventPartitionSpec {
  broker = new ServiceBroker({ logger: false });

  createEventPartitionJob?: CreateEventPartitionJob;

  @BeforeAll()
  async renameEvent(): Promise<void> {
    await knex.raw('ALTER TABLE event RENAME TO event_backup');
    await knex.raw('ALTER TABLE event_partition RENAME TO event');
  }

  @BeforeEach()
  async initSuite() {
    this.createEventPartitionJob = this.broker.createService(
      CreateEventPartitionJob
    ) as CreateEventPartitionJob;
  }

  @Test('No event exist on table => Dont need to create partition')
  public async test1() {
    await knex.raw('TRUNCATE TABLE event RESTART IDENTITY CASCADE');
    const result =
      await this.createEventPartitionJob?.jobCreateEventPartition();
    expect(result).toEqual(false);
  }

  @Test('Test function consider partition create base on latest event id')
  public async test2() {
    const mockEvent = new Event();
    /**
     *@description: Failed because partition from 0 -> 200000000, id is 99999999
     * so id not reach to half of support value from partition, so we expect return null
     */
    mockEvent.id = (config.migrationEventToPartition.step / 2 - 1).toString();
    const result = await this.createEventPartitionJob?.createPartitionName(
      mockEvent
    );
    expect(result).toBe(null);

    /**
     *@description: True because partition from 0 -> 200000000, id is 100000001
     * so id reach to half of support value from partition, so we expect return partition information
     */
    const mockEvent1 = new Event();
    mockEvent1.id = (config.migrationEventToPartition.step / 2 + 1).toString();
    const result1 =
      this.createEventPartitionJob?.createPartitionName(mockEvent1);
    expect(result1).toBeDefined();
  }

  @Test('Test build partition name')
  public async test3() {
    /**
     * @description: Because id not reach to half of partition will be blocked by test case above, so in this case
     * we just need to test for id reach to half of partition value
     */
    const mockEvent = new Event();
    mockEvent.id = '100000001';
    const partitionInfo =
      await this.createEventPartitionJob?.createPartitionName(mockEvent);
    expect(partitionInfo).toBeDefined();

    /**
     * @description when max event id reach to 900000001 then we need to create next partition
     */
    const mockEvent1 = new Event();
    mockEvent1.id = '900000001';
    const partitionInfo1 =
      await this.createEventPartitionJob?.createPartitionName(mockEvent1);
    expect(partitionInfo1?.fromEventId).toEqual('1000000000');
    expect(partitionInfo1?.toEventId).toEqual('1200000000');
    expect(partitionInfo1?.partitionName).toEqual(
      'event_partition_1000000000_1200000000'
    );
  }

  @Test('Test create partition on database')
  public async test4() {
    const mockEvent = new Event();
    mockEvent.id = '900000001';
    const partitionInfo =
      await this.createEventPartitionJob?.createPartitionName(mockEvent);
    if (partitionInfo) {
      await this.createEventPartitionJob?.createPartitionByPartitionInfo(
        partitionInfo
      );
    }

    /**
     * @description partition now created so isCreated now will be false because partition already exist
     */
    const checkAgainPartitionInfo =
      await this.createEventPartitionJob?.createPartitionName(mockEvent);
    expect(checkAgainPartitionInfo).toEqual(null);
    await knex.raw(`DROP TABLE ${partitionInfo?.partitionName} CASCADE`);
  }

  @AfterAll()
  async tearDown() {
    await knex.raw('TRUNCATE TABLE event RESTART IDENTITY CASCADE');
    await knex.raw('ALTER TABLE event RENAME TO event_partition');
    await knex.raw('ALTER TABLE event_backup RENAME TO event');
  }
}
