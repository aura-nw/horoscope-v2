import { BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import CreateConstraintInEventPartitionJob from '../../../../src/services/job/create_constraint_in_event_partition.service';
import { Event } from '../../../../src/models';

@Describe('Test create constraint for event partition')
export default class CreateEventConstraintPartitionSpec {
  broker = new ServiceBroker({ logger: false });

  createConstraintInEventPartitionJob?: CreateConstraintInEventPartitionJob;

  private async insertFakeEventWithInputId(desiredId: number): Promise<void> {
    const newEvent = new Event();
    newEvent.id = desiredId.toString();
    newEvent.tx_id = 1;
    newEvent.type = 'transfer';
    newEvent.block_height = 1;
    newEvent.source = '1';
    await Event.query().insert(newEvent);
  }

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
    await knex.raw('TRUNCATE TABLE event RESTART IDENTITY CASCADE');
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

    // After insert one tx, now we expect constraint created
    await this.insertFakeEventWithInputId(Number(partitions[0].fromId) + 1);
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
    await this.insertFakeEventWithInputId(Number(partitions[0].fromId) + 10);
    const stillInsertingOrDont =
      await this.createConstraintInEventPartitionJob?.createEventConstraint(
        partitions[0]
      );
    expect(stillInsertingOrDont).toEqual(
      this.createConstraintInEventPartitionJob?.createConstraintEventStatus
        .currentPartitionDoneOrInserting
    );

    // After insert tx with id reach to max id of partition, now partition is ready for create full constraint, constraint now will be updated
    await this.insertFakeEventWithInputId(Number(partitions[0].toId) - 1);
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
  }
}
