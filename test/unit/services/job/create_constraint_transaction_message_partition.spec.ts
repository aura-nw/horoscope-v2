import { BeforeEach, Describe, Test } from '@jest-decorated/core';
import { ServiceBroker } from 'moleculer';
import knex from '../../../../src/common/utils/db_connection';
import CreateConstraintInTransactionMessagePartitionJob from '../../../../src/services/job/create_constraint_in_transaction_message_partition.service';
import { TransactionMessage } from '../../../../src/models';

@Describe('Test create constraint for transaction_message partition')
export default class CreateTransactionMessageConstraintPartitionSpec {
  broker = new ServiceBroker({ logger: false });

  createConstaintTxMsgJob?: CreateConstraintInTransactionMessagePartitionJob;

  private async insertFakeTxMsgWithInputId(desiredId: number): Promise<void> {
    const newTxMsg = new TransactionMessage();
    newTxMsg.id = desiredId;
    newTxMsg.tx_id = 1;
    newTxMsg.type = 'transfer';
    newTxMsg.sender = '1';
    newTxMsg.index = 0;
    newTxMsg.content = {};
    await TransactionMessage.query().insert(newTxMsg);
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
    this.createConstaintTxMsgJob = this.broker.createService(
      CreateConstraintInTransactionMessagePartitionJob
    ) as CreateConstraintInTransactionMessagePartitionJob;
  }

  @Test('Test create constraint on first transaction_message partition')
  public async test1() {
    await knex.raw(
      'TRUNCATE TABLE transaction_message RESTART IDENTITY CASCADE'
    );
    const partitions =
      await this.createConstaintTxMsgJob?.getTxMsgPartitionInfo();

    // We have 2 partition by default after run migration
    expect(partitions?.length).toEqual(2);
    if (!partitions) throw Error('No partition found');

    // Now partition is empty so result return will be empty and no constraint create
    const emptyStatus =
      await this.createConstaintTxMsgJob?.createTransactionMessageConstraint(
        partitions[0]
      );
    expect(emptyStatus).toEqual(
      this.createConstaintTxMsgJob?.createConstraintTxMsgStatus
        .currentPartitionEmpty
    );

    // After insert one tx, now we expect constraint created
    await this.insertFakeTxMsgWithInputId(Number(partitions[0].fromId) + 1);
    const constraintUpdated =
      await this.createConstaintTxMsgJob?.createTransactionMessageConstraint(
        partitions[0]
      );
    expect(constraintUpdated).toEqual(
      this.createConstaintTxMsgJob?.createConstraintTxMsgStatus
        .constraintUpdated
    );

    // Verify constraint created
    const expectedInsertingConstraintName = `txmsg_ct_${partitions[0].name}_${this.createConstaintTxMsgJob?.insertionStatus.inserting}`;
    const isInsertingConstraintExist = await this.isConstraintNameExist(
      partitions[0].name,
      expectedInsertingConstraintName
    );
    expect(isInsertingConstraintExist).toEqual(true);

    // After insert next tx, because id now not reach to max id of partition, and we already have constraint created before, so now status will be still inserting or done
    await this.insertFakeTxMsgWithInputId(Number(partitions[0].fromId) + 10);
    const stillInsertingOrDont =
      await this.createConstaintTxMsgJob?.createTransactionMessageConstraint(
        partitions[0]
      );
    expect(stillInsertingOrDont).toEqual(
      this.createConstaintTxMsgJob?.createConstraintTxMsgStatus
        .currentPartitionDoneOrInserting
    );

    // After insert tx with id reach to max id of partition, now partition is ready for create full constraint, constraint now will be updated
    await this.insertFakeTxMsgWithInputId(Number(partitions[0].toId) - 1);
    const constraintCreatedDone =
      await this.createConstaintTxMsgJob?.createTransactionMessageConstraint(
        partitions[0]
      );
    expect(constraintCreatedDone).toEqual(
      this.createConstaintTxMsgJob?.createConstraintTxMsgStatus
        .constraintUpdated
    );

    // Verify constraint created
    const expectedDoneConstraintName = `txmsg_ct_${partitions[0].name}_${this.createConstaintTxMsgJob?.insertionStatus.done}`;
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
      await this.createConstaintTxMsgJob?.createTransactionMessageConstraint(
        partitions[0]
      );
    expect(checkAgainStatus).toEqual(
      this.createConstaintTxMsgJob?.createConstraintTxMsgStatus
        .currentPartitionDoneOrInserting
    );

    await knex.raw(`
      ALTER TABLE ${partitions[0].name} DROP CONSTRAINT ${expectedDoneConstraintName};
    `);
  }
}
