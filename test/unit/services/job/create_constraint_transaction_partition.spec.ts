import { BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import CreateConstraintInTransactionPartitionJob from '../../../../src/services/job/create_constraint_in_transaction_partition.service';
import { Transaction } from '../../../../src/models';

@Describe('Test create constraint for transaction partition')
export default class CreateConstraintTransactionPartitionSpec {
  broker = new ServiceBroker({ logger: false });

  createConstraintInTransactionPartitionJob?: CreateConstraintInTransactionPartitionJob;

  private async insertFakeTxWithInputId(desiredId: number): Promise<void> {
    const newTx = new Transaction();
    newTx.id = desiredId;
    newTx.height = desiredId;
    newTx.hash = new Date().getTime().toString();
    newTx.codespace = 'test';
    newTx.code = 1;
    newTx.gas_used = '1';
    newTx.gas_wanted = '1';
    newTx.gas_limit = '1';
    newTx.fee = '1';
    newTx.timestamp = new Date();
    newTx.data = {};
    await Transaction.query().insert(newTx);
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
    this.createConstraintInTransactionPartitionJob = this.broker.createService(
      CreateConstraintInTransactionPartitionJob
    ) as CreateConstraintInTransactionPartitionJob;
  }

  @Test('Test create constraint on first transaction partition')
  public async test1() {
    await knex.raw('TRUNCATE TABLE transaction RESTART IDENTITY CASCADE');
    const partitions =
      await this.createConstraintInTransactionPartitionJob?.getTransactionPartitionInfo();

    // We have 2 partition by default after run migration
    expect(partitions?.length).toEqual(2);
    if (!partitions) throw Error('No partition found');

    // Now partition is empty so result return will be empty and no constraint create
    const emptyStatus =
      await this.createConstraintInTransactionPartitionJob?.createTransactionConstraint(
        partitions[0]
      );
    expect(emptyStatus).toEqual(
      this.createConstraintInTransactionPartitionJob
        ?.createConstraintTransactionStatus.currentPartitionEmpty
    );

    // After insert one tx, now we expect constraint created
    await this.insertFakeTxWithInputId(Number(partitions[0].fromId) + 1);
    const constraintUpdated =
      await this.createConstraintInTransactionPartitionJob?.createTransactionConstraint(
        partitions[0]
      );
    expect(constraintUpdated).toEqual(
      this.createConstraintInTransactionPartitionJob
        ?.createConstraintTransactionStatus.constraintUpdated
    );

    // Verify constraint created
    const expectedInsertingConstraintName = `tx_ct_${partitions[0].name}_${this.createConstraintInTransactionPartitionJob?.insertionStatus.inserting}`;
    const isInsertingConstraintExist = await this.isConstraintNameExist(
      partitions[0].name,
      expectedInsertingConstraintName
    );
    expect(isInsertingConstraintExist).toEqual(true);

    // After insert next tx, because id now not reach to max id of partition, and we already have constraint created before, so now status will be still inserting or done
    await this.insertFakeTxWithInputId(Number(partitions[0].fromId) + 10);
    const stillInsertingOrDont =
      await this.createConstraintInTransactionPartitionJob?.createTransactionConstraint(
        partitions[0]
      );
    expect(stillInsertingOrDont).toEqual(
      this.createConstraintInTransactionPartitionJob
        ?.createConstraintTransactionStatus.currentPartitionDoneOrInserting
    );

    // After insert tx with id reach to max id of partition, now partition is ready for create full constraint, constraint now will be updated
    await this.insertFakeTxWithInputId(Number(partitions[0].toId) - 1);
    const constraintCreatedDone =
      await this.createConstraintInTransactionPartitionJob?.createTransactionConstraint(
        partitions[0]
      );
    expect(constraintCreatedDone).toEqual(
      this.createConstraintInTransactionPartitionJob
        ?.createConstraintTransactionStatus.constraintUpdated
    );

    // Verify constraint created
    const expectedDoneConstraintName = `tx_ct_${partitions[0].name}_${this.createConstraintInTransactionPartitionJob?.insertionStatus.done}`;
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
      await this.createConstraintInTransactionPartitionJob?.createTransactionConstraint(
        partitions[0]
      );
    expect(checkAgainStatus).toEqual(
      this.createConstraintInTransactionPartitionJob
        ?.createConstraintTransactionStatus.currentPartitionDoneOrInserting
    );

    await knex.raw(`
      ALTER TABLE ${partitions[0].name} DROP CONSTRAINT ${expectedDoneConstraintName};
    `);
  }
}
