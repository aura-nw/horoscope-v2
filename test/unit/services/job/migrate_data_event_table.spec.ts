import { BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import MigrateDataEventTableJob from '../../../../src/services/job/migrate_data_event_table.service';
import CreateConstraintInEventPartitionJob from '../../../../src/services/job/create_constraint_in_event_partition.service';
import { insertFakeBlockWithHeight } from '../../mock-data/block.mock';
import {
  insertFakeEventWithInputId,
  getAllEvent,
} from '../../mock-data/event.mock';
import { insertFakeTxWithInputId } from '../../mock-data/transaction.mock';
import config from '../../../../config.json' assert { type: 'json' };

@Describe('Test migrate data from event table to event partition table')
export default class MigrateDateEventTableSpec {
  broker = new ServiceBroker({ logger: false });

  migrateDataEventTableJob?: MigrateDataEventTableJob;

  createConstraintInEventPartitionJob?: CreateConstraintInEventPartitionJob;

  @BeforeEach()
  async initSuite() {
    this.migrateDataEventTableJob = this.broker.createService(
      MigrateDataEventTableJob
    ) as MigrateDataEventTableJob;
    this.createConstraintInEventPartitionJob = this.broker.createService(
      CreateConstraintInEventPartitionJob
    ) as CreateConstraintInEventPartitionJob;
  }

  @Test('Test create partition and migrate data from event to event partition')
  public async test1() {
    await knex.raw(
      'TRUNCATE TABLE block, transaction, event RESTART IDENTITY CASCADE'
    );
    await insertFakeBlockWithHeight(1);
    await insertFakeTxWithInputId(1, 1);
    await insertFakeEventWithInputId(1, 1, 1);
    await insertFakeEventWithInputId(
      config.migrationEventToPartition.step + 1,
      1,
      1
    );
    await this.migrateDataEventTableJob?.migrateEventPartition();
    const listEventPartition =
      await this.createConstraintInEventPartitionJob?.getEventPartitionInfo();
    const events = await getAllEvent();
    // Validate event partition
    expect(listEventPartition?.length).toEqual(3);
    expect(events.length).toEqual(2);

    // Return back to previous state before run this test
    const dropPartition = listEventPartition?.map((partition) => knex.raw(`DROP TABLE ${partition.name}`));
    await Promise.any(dropPartition ?? []);
    await knex.raw('ALTER TABLE event rename to event_partition');
    await knex.raw('ALTER TABLE event_backup RENAME TO event');
    // validate old event table before truncate
    const oldEvents = await getAllEvent();
    expect(oldEvents.length).toEqual(2);
    await knex.raw(
      'TRUNCATE TABLE block, transaction, event RESTART IDENTITY CASCADE'
    );
  }
}
