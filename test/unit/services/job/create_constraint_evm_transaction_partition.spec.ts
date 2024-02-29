import { BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import CreateConstraintInEVMTransactionPartitionJob from '../../../../src/services/job/create_constraint_in_evm_transaction_partition.service';
import { EVMTransaction } from '../../../../src/models';

@Describe('Test create constraint for evm_transaction partition')
export default class CreateEVMTransactionConstraintPartitionSpec {
  broker = new ServiceBroker({ logger: false });

  createConstaintEVMTxJob?: CreateConstraintInEVMTransactionPartitionJob;

  private async insertFakeEVMTxWithInputId(desiredId: number): Promise<void> {
    const newEVMTx = new EVMTransaction();
    newEVMTx.id = desiredId;
    newEVMTx.tx_id = 1;
    newEVMTx.tx_msg_id = 2;
    newEVMTx.hash = 'hash';
    newEVMTx.height = 123;
    await EVMTransaction.query().insert(newEVMTx);
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
    this.createConstaintEVMTxJob = this.broker.createService(
      CreateConstraintInEVMTransactionPartitionJob
    ) as CreateConstraintInEVMTransactionPartitionJob;
  }

  @Test('Test create constraint on first evm_transaction partition')
  public async test1() {
    await knex.raw('TRUNCATE TABLE evm_transaction RESTART IDENTITY CASCADE');
    const partitions =
      await this.createConstaintEVMTxJob?.getEVMTxPartitionInfo();

    // We have 2 partition by default after run migration
    expect(partitions?.length).toEqual(2);
    if (!partitions) throw Error('No partition found');

    // Now partition is empty so result return will be empty and no constraint create
    const emptyStatus =
      await this.createConstaintEVMTxJob?.createEVMTransactionConstraint(
        partitions[0]
      );
    expect(emptyStatus).toEqual(
      this.createConstaintEVMTxJob?.createConstraintEVMTxStatus
        .currentPartitionEmpty
    );

    // After insert one tx, now we expect constraint created
    await this.insertFakeEVMTxWithInputId(Number(partitions[0].fromId) + 1);
    const constraintUpdated =
      await this.createConstaintEVMTxJob?.createEVMTransactionConstraint(
        partitions[0]
      );
    expect(constraintUpdated).toEqual(
      this.createConstaintEVMTxJob?.createConstraintEVMTxStatus
        .constraintUpdated
    );

    // Verify constraint created
    const expectedInsertingConstraintName = `evmtx_ct_${partitions[0].name}_${this.createConstaintEVMTxJob?.insertionStatus.inserting}`;
    const isInsertingConstraintExist = await this.isConstraintNameExist(
      partitions[0].name,
      expectedInsertingConstraintName
    );
    expect(isInsertingConstraintExist).toEqual(true);

    // After insert next tx, because id now not reach to max id of partition, and we already have constraint created before, so now status will be still inserting or done
    await this.insertFakeEVMTxWithInputId(Number(partitions[0].fromId) + 10);
    const stillInsertingOrDont =
      await this.createConstaintEVMTxJob?.createEVMTransactionConstraint(
        partitions[0]
      );
    expect(stillInsertingOrDont).toEqual(
      this.createConstaintEVMTxJob?.createConstraintEVMTxStatus
        .currentPartitionDoneOrInserting
    );

    // After insert tx with id reach to max id of partition, now partition is ready for create full constraint, constraint now will be updated
    await this.insertFakeEVMTxWithInputId(Number(partitions[0].toId) - 1);
    const constraintCreatedDone =
      await this.createConstaintEVMTxJob?.createEVMTransactionConstraint(
        partitions[0]
      );
    expect(constraintCreatedDone).toEqual(
      this.createConstaintEVMTxJob?.createConstraintEVMTxStatus
        .constraintUpdated
    );

    // Verify constraint created
    const expectedDoneConstraintName = `evmtx_ct_${partitions[0].name}_${this.createConstaintEVMTxJob?.insertionStatus.done}`;
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
      await this.createConstaintEVMTxJob?.createEVMTransactionConstraint(
        partitions[0]
      );
    expect(checkAgainStatus).toEqual(
      this.createConstaintEVMTxJob?.createConstraintEVMTxStatus
        .currentPartitionDoneOrInserting
    );

    await knex.raw(`
      ALTER TABLE ${partitions[0].name} DROP CONSTRAINT ${expectedDoneConstraintName};
    `);
  }
}
