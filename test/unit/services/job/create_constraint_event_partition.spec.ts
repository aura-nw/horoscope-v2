import { BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import CreateConstraintInEventPartitionJob from '../../../../src/services/job/create_constraint_in_event_partition.service';
import { insertFakeEventWithInputId } from '../../mock-data/event.mock';
import { insertFakeBlockWithHeight } from '../../mock-data/block.mock';
import { insertFakeTxWithInputId } from '../../mock-data/transaction.mock';

@Describe('Test create constraint for event partition')
export default class CreateEventConstraintPartitionSpec {
  broker = new ServiceBroker({ logger: false });

  createConstraintInEventPartitionJob?: CreateConstraintInEventPartitionJob;

  private async isConstraintNameExist(
    partitionName: string,
    constraintName: string
  ): Promise<boolean> {
    const constraintResult = await knex.raw(`
        SELECT
            connamespace::regnamespace "schema",
            conrelid::regclass "table",
            conname "constraint",
            pg_get_constraintdef(oid) "definition"
        FROM pg_constraint
        WHERE conrelid = '${partitionName}'::regclass and conname like '${constraintName}'
    `);
    return !!constraintResult.rows[0];
  }

  @BeforeEach()
  async initSuite() {
    this.createConstraintInEventPartitionJob = this.broker.createService(
      CreateConstraintInEventPartitionJob
    ) as CreateConstraintInEventPartitionJob;
  }

  @Test('Test create constraint on first event partition')
  public async test1() {
    await knex.raw(
      'TRUNCATE TABLE block, transaction, event, event_partition RESTART IDENTITY CASCADE'
    );
    await knex.raw('ALTER TABLE event RENAME TO event_backup');
    await knex.raw('ALTER TABLE event_partition RENAME TO event');
    await knex.raw(
      'CREATE TABLE event_partition_0_200000000 (LIKE event INCLUDING ALL)'
    );
    await knex.raw(
      'ALTER TABLE event ATTACH PARTITION event_partition_0_200000000 FOR VALUES FROM (0) TO (200000000)'
    );
    const partitions =
      await this.createConstraintInEventPartitionJob?.getEventPartitionInfo();

    if (!partitions) throw Error('No partition found');

    // Now partition is empty so result return will be empty and no constraint create
    const emptyStatus =
      await this.createConstraintInEventPartitionJob?.createEventConstraint(
        partitions[0]
      );
    expect(emptyStatus).toEqual(
      this.createConstraintInEventPartitionJob?.createConstraintEventStatus
        .currentPartitionEmpty
    );

    await insertFakeBlockWithHeight(1);
    await insertFakeTxWithInputId(1, 1);
    // After insert one tx, now we expect constraint created
    await insertFakeEventWithInputId(Number(partitions[0].fromId) + 1, 1, 1);
    const constraintUpdated =
      await this.createConstraintInEventPartitionJob?.createEventConstraint(
        partitions[0]
      );
    expect(constraintUpdated).toEqual(
      this.createConstraintInEventPartitionJob?.createConstraintEventStatus
        .constraintUpdated
    );

    // Verify constraint created
    const expectedInsertingConstraintName = `event_ct_${partitions[0].name}_${this.createConstraintInEventPartitionJob?.insertionStatus.inserting}`;
    const isInsertingConstraintExist = await this.isConstraintNameExist(
      partitions[0].name,
      expectedInsertingConstraintName
    );
    expect(isInsertingConstraintExist).toEqual(true);

    // After insert next tx, because id now not reach to max id of partition, and we already have constraint created before, so now status will be still inserting or done
    await insertFakeEventWithInputId(Number(partitions[0].fromId) + 10, 1, 1);
    const stillInsertingOrDont =
      await this.createConstraintInEventPartitionJob?.createEventConstraint(
        partitions[0]
      );
    expect(stillInsertingOrDont).toEqual(
      this.createConstraintInEventPartitionJob?.createConstraintEventStatus
        .currentPartitionDoneOrInserting
    );

    // After insert tx with id reach to max id of partition, now partition is ready for create full constraint, constraint now will be updated
    await insertFakeEventWithInputId(Number(partitions[0].toId) - 1, 1, 1);
    const constraintCreatedDone =
      await this.createConstraintInEventPartitionJob?.createEventConstraint(
        partitions[0]
      );
    expect(constraintCreatedDone).toEqual(
      this.createConstraintInEventPartitionJob?.createConstraintEventStatus
        .constraintUpdated
    );

    // Verify constraint created
    const expectedDoneConstraintName = `event_ct_${partitions[0].name}_${this.createConstraintInEventPartitionJob?.insertionStatus.done}`;
    const isDoneConstraintExist = await this.isConstraintNameExist(
      partitions[0].name,
      expectedDoneConstraintName
    );
    const isInsertingConstraintNotExist = await this.isConstraintNameExist(
      partitions[0].name,
      expectedInsertingConstraintName
    );
    expect(isDoneConstraintExist).toEqual(true);
    expect(isInsertingConstraintNotExist).toEqual(false);

    const checkAgainStatus =
      await this.createConstraintInEventPartitionJob?.createEventConstraint(
        partitions[0]
      );
    expect(checkAgainStatus).toEqual(
      this.createConstraintInEventPartitionJob?.createConstraintEventStatus
        .currentPartitionDoneOrInserting
    );

    await knex.raw(`
      ALTER TABLE ${partitions[0].name} DROP CONSTRAINT ${expectedDoneConstraintName};
    `);
    await knex.raw('DROP TABLE event_partition_0_200000000');
    await knex.raw('ALTER TABLE event RENAME TO event_partition');
    await knex.raw('ALTER TABLE event_backup RENAME TO event');
    await knex.raw(
      'TRUNCATE TABLE block, transaction, event, event_partition RESTART IDENTITY CASCADE'
    );
  }
}
