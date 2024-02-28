/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import { EVMTransaction } from '../../models';

@Service({
  name: SERVICE.V1.JobService.CreateConstraintInEVMTransactionPartition.key,
  version: 1,
})
export default class CreateConstraintInEVMTransactionPartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  public createConstraintEVMTxStatus = {
    currentPartitionEmpty: 'currentPartitionEmpty',
    currentPartitionDoneOrInserting: 'currentPartitionDoneOrInserting',
    constraintUpdated: 'constraintUpdated',
  };

  public insertionStatus = {
    empty: 'empty',
    done: 'done',
    inserting: 'inserting',
  };

  public async getLatestEVMTxByPartition(
    partitionName: string
  ): Promise<EVMTransaction> {
    const latestEVMTx = await knex.raw(`
      SELECT * FROM ${partitionName} ORDER BY id DESC LIMIT 1
    `);
    return latestEVMTx.rows[0];
  }

  /**
   * @description get max min tx_id and max min tx_msg_id in partition
   * @param partitionName
   */
  public async getMaxMinTxIdAndTxMsgIdByPartition(
    partitionName: string
  ): Promise<{
    min_tx_id: number;
    max_tx_id: number;
    min_tx_msg_id: number;
    max_tx_msg_id: number;
  }> {
    await knex.raw(
      `set statement_timeout to ${config.jobCreateConstraintInEVMTransactionPartition.statementTimeout}`
    );
    const boundariesResult = await knex.raw(`
        SELECT
            min(tx_id) min_tx_id, max(tx_id) max_tx_id, 
            min(tx_msg_id) min_tx_msg_id, max(tx_msg_id) max_tx_msg_id 
            FROM ${partitionName}`);
    return {
      min_tx_id: boundariesResult.rows[0].min_tx_id,
      max_tx_id: boundariesResult.rows[0].max_tx_id,
      min_tx_msg_id: boundariesResult.rows[0].min_tx_msg_id,
      max_tx_msg_id: boundariesResult.rows[0].max_tx_msg_id,
    };
  }

  /**
   * @description Check partition insertion is done or inserting or empty
   * @param partitionName
   * @param toId
   * @public
   */
  public async getPartitionInsertionInfo(
    partitionName: string,
    toId: string
  ): Promise<string> {
    const latestEVMTxPartition = await this.getLatestEVMTxByPartition(
      partitionName
    );

    if (!latestEVMTxPartition) return this.insertionStatus.empty;

    const endValueOfPartition = BigNumber(toId).minus(1);

    if (endValueOfPartition.eq(latestEVMTxPartition.id))
      return this.insertionStatus.done;

    return this.insertionStatus.inserting;
  }

  /**
   * @description Get current constraint of partition
   * @param partitionName
   */
  public async getCurrentConstrainInfo(partitionName: string): Promise<string> {
    const constraintResult = await knex.raw(`
        SELECT
            connamespace::regnamespace "schema",
            conrelid::regclass "table",
            conname "constraint",
            pg_get_constraintdef(oid) "definition"
        FROM pg_constraint
        WHERE conrelid = '${partitionName}'::regclass and conname like 'evmtx_ct%'
    `);
    const result = constraintResult.rows.map(
      (constraint: { constraint: string }) => constraint.constraint
    );
    return result[0];
  }

  /**
   * @description Prepare constraint, decide to create new, drop or do nothing
   * @param partitionName
   * @param currentConstraintName
   * @param insertionStatus (done, inserting, empty)
   * @public
   */
  public async prepareConstraintInformation(
    partitionName: string,
    insertionStatus: string,
    currentConstraintName: string
  ): Promise<{ createConstraint: any; dropConstraint: any } | null> {
    // Don't need to create constraint because current partition is empty
    if (insertionStatus === this.insertionStatus.empty) return null;

    const maxMinTxId = await this.getMaxMinTxIdAndTxMsgIdByPartition(
      partitionName
    );

    if (insertionStatus === this.insertionStatus.inserting) {
      // Current inserting and having constraint so do nothing
      if (currentConstraintName) return null;

      return {
        createConstraint: {
          fromTxId: maxMinTxId.min_tx_id,
          toTxId: null,
          fromTxMsgId: maxMinTxId.min_tx_msg_id,
          toTxMsgId: null,
        },
        dropConstraint: null,
      };
    }

    if (currentConstraintName) {
      // Naming like constraintName_status, so pop() will get current status of constraint
      const constraintStatus = currentConstraintName.split('_').pop();
      // Current done and having full constraint so do nothing
      if (constraintStatus === this.insertionStatus.done) return null;
    }

    return {
      createConstraint: {
        fromTxId: maxMinTxId.min_tx_id,
        toTxId: maxMinTxId.max_tx_id,
        fromTxMsgId: maxMinTxId.min_tx_msg_id,
        toTxMsgId: maxMinTxId.max_tx_msg_id,
      },
      dropConstraint: currentConstraintName,
    };
  }

  /**
   * @description Get list partition of transaction message table
   */
  public async getEVMTxPartitionInfo(): Promise<
    {
      name: string;
      fromId: string;
      toId: string;
    }[]
  > {
    const partitionTable = await knex.raw(`
        SELECT
            parent.relname AS parent,
            child.relname AS child,
            pg_get_expr(child.relpartbound, child.oid) AS bounds
        FROM pg_inherits
            JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
            JOIN pg_class child ON pg_inherits.inhrelid   = child.oid
        WHERE parent.relname = 'evm_transaction';
    `);
    return partitionTable.rows.map((partition: any) => {
      const partitionBounds = partition.bounds;
      return {
        name: partition.child,
        fromId: partitionBounds.match(/\d+/g)[0],
        toId: partitionBounds.match(/\d+/g)[1],
      };
    });
  }

  public async createConstraint(
    partitionName: string,
    fromTxId: number,
    toTxId: number | null,
    fromTxMsgId: number,
    toTxMsgId: number | null,
    currentConstraintName: string
  ): Promise<void> {
    let constraintName: string;
    let checkConstraint: string;

    if (toTxId === null) {
      constraintName = `evmtx_ct_${partitionName}_${this.insertionStatus.inserting}`;
      checkConstraint = `(tx_id >= ${fromTxId} AND tx_msg_id >= ${fromTxMsgId})`;
    } else {
      constraintName = `evmtx_ct_${partitionName}_${this.insertionStatus.done}`;
      checkConstraint = `(tx_id >= ${fromTxId} AND tx_id <= ${toTxId} AND tx_msg_id >= ${fromTxMsgId} and tx_msg_id <= ${toTxMsgId})`;
    }

    await knex.transaction(async (trx) => {
      if (currentConstraintName) {
        this.logger.info(`DROP constraint ${currentConstraintName}`);
        await knex
          .raw(
            `ALTER TABLE ${partitionName} DROP CONSTRAINT ${currentConstraintName}`
          )
          .transacting(trx);
      }
      await knex
        .raw(
          `
        ALTER TABLE ${partitionName}
        ADD CONSTRAINT ${constraintName} check ${checkConstraint} not valid
      `
        )
        .transacting(trx);
      await knex
        .raw(
          `
        ALTER TABLE ${partitionName} validate constraint ${constraintName}
      `
        )
        .transacting(trx);
      this.logger.info(`Constraint created with name ${constraintName}`);
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CREATE_EVM_TRANSACTION_CONSTRAINT,
    jobName: BULL_JOB_NAME.JOB_CREATE_EVM_TRANSACTION_CONSTRAINT,
  })
  public async createEVMTransactionConstraint(_payload: {
    name: string;
    fromId: string;
    toId: string;
  }): Promise<string> {
    const partitionInsertionStatus = await this.getPartitionInsertionInfo(
      _payload.name,
      _payload.toId
    );
    if (partitionInsertionStatus === this.insertionStatus.empty) {
      this.logger.info(
        "Current partition is empty, so don't need to create constraint",
        _payload.name
      );
      return this.createConstraintEVMTxStatus.currentPartitionEmpty;
    }

    const currentConstraint = await this.getCurrentConstrainInfo(_payload.name);
    const prepareConstraintCreation = await this.prepareConstraintInformation(
      _payload.name,
      partitionInsertionStatus,
      currentConstraint
    );

    if (!prepareConstraintCreation) {
      this.logger.info(
        "Current partition is not done and already having constraint or already having full constraint, so don't need to create constraint",
        _payload.name
      );
      return this.createConstraintEVMTxStatus.currentPartitionDoneOrInserting;
    }

    await this.createConstraint(
      _payload.name,
      prepareConstraintCreation.createConstraint.fromTxId,
      prepareConstraintCreation.createConstraint.toTxId,
      prepareConstraintCreation.createConstraint.fromTxMsgId,
      prepareConstraintCreation.createConstraint.toTxMsgId,
      prepareConstraintCreation.dropConstraint
    );
    return this.createConstraintEVMTxStatus.constraintUpdated;
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CHECK_EVM_TRANSACTION_CONSTRAINT,
    jobName: BULL_JOB_NAME.JOB_CHECK_EVM_TRANSACTION_CONSTRAINT,
  })
  public async createConstraintInEVMTxPartition() {
    const listPartition = await this.getEVMTxPartitionInfo();
    listPartition.forEach(
      (partition: { name: string; fromId: string; toId: string }) => {
        this.createJob(
          BULL_JOB_NAME.JOB_CREATE_EVM_TRANSACTION_CONSTRAINT,
          BULL_JOB_NAME.JOB_CREATE_EVM_TRANSACTION_CONSTRAINT,
          partition,
          {
            jobId: partition.name,
            removeOnComplete: true,
            removeOnFail: {
              count: 3,
            },
          }
        );
      }
    );
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.JOB_CHECK_EVM_TRANSACTION_CONSTRAINT,
      BULL_JOB_NAME.JOB_CHECK_EVM_TRANSACTION_CONSTRAINT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every:
            config.jobCreateConstraintInEVMTransactionPartition
              .jobRepeatCheckNeedCreateConstraint.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
