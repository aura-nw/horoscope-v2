/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import { TransactionMessage } from '../../models';

@Service({
  name: SERVICE.V1.JobService.CreateConstraintInTransactionMessagePartition.key,
  version: 1,
})
export default class CreateConstraintInTransactionMessagePartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  public createConstraintTxMsgStatus = {
    currentPartitionEmpty: 'currentPartitionEmpty',
    currentPartitionDoneOrInserting: 'currentPartitionDoneOrInserting',
    constraintUpdated: 'constraintUpdated',
  };

  public insertionStatus = {
    empty: 'empty',
    done: 'done',
    inserting: 'inserting',
  };

  public async getLatestTxMsgByPartition(
    partitionName: string
  ): Promise<TransactionMessage> {
    const latestTxMsg = await knex.raw(`
      SELECT * FROM ${partitionName} ORDER BY id DESC LIMIT 1
    `);
    return latestTxMsg.rows[0];
  }

  /**
   * @description get max min tx_id and max min block height in partition
   * @param partitionName
   */
  public async getMaxMinTxIdByPartition(partitionName: string): Promise<{
    min_tx_id: number;
    max_tx_id: number;
  }> {
    await knex.raw(
      `set statement_timeout to ${config.jobCreateConstraintInTransactionMessagePartition.statementTimeout}`
    );
    const boundariesResult = await knex.raw(`
        SELECT
            min(tx_id) min_tx_id, max(tx_id) max_tx_id FROM ${partitionName}`);

    return {
      min_tx_id: boundariesResult.rows[0].min_tx_id,
      max_tx_id: boundariesResult.rows[0].max_tx_id,
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
    const latestTxMsgPartition = await this.getLatestTxMsgByPartition(
      partitionName
    );

    if (!latestTxMsgPartition) return this.insertionStatus.empty;

    const endValueOfPartition = BigNumber(toId).minus(1);

    if (endValueOfPartition.eq(latestTxMsgPartition.id))
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
        WHERE conrelid = '${partitionName}'::regclass and conname like 'txmsg_ct%'
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
  public async prepareConstrainInformation(
    partitionName: string,
    insertionStatus: string,
    currentConstraintName: string
  ): Promise<{ createConstraint: any; dropConstraint: any } | null> {
    // Don't need to create constraint because current partition is empty
    if (insertionStatus === this.insertionStatus.empty) return null;

    const maxMinTxId = await this.getMaxMinTxIdByPartition(partitionName);

    if (insertionStatus === this.insertionStatus.inserting) {
      // Current inserting and having constraint so do nothing
      if (currentConstraintName) return null;

      return {
        createConstraint: {
          fromTxId: maxMinTxId.min_tx_id,
          toTxId: null,
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
      },
      dropConstraint: currentConstraintName,
    };
  }

  /**
   * @description Get list partition of transaction message table
   */
  public async getTxMsgPartitionInfo(): Promise<
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
        WHERE parent.relname = 'transaction_message';
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
    currentConstraintName: string
  ): Promise<void> {
    let constraintName: string;
    let checkConstraint: string;

    if (toTxId === null) {
      constraintName = `txmsg_ct_${partitionName}_${this.insertionStatus.inserting}`;
      checkConstraint = `(tx_id >= ${fromTxId})`;
    } else {
      constraintName = `txmsg_ct_${partitionName}_${this.insertionStatus.done}`;
      checkConstraint = `(tx_id >= ${fromTxId} AND tx_id <= ${toTxId})`;
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
    queueName: BULL_JOB_NAME.JOB_CREATE_TRANSACTION_MESSAGE_CONSTRAINT,
    jobName: BULL_JOB_NAME.JOB_CREATE_TRANSACTION_MESSAGE_CONSTRAINT,
  })
  public async createTransactionMessageConstraint(_payload: {
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
      return this.createConstraintTxMsgStatus.currentPartitionEmpty;
    }

    const currentConstraint = await this.getCurrentConstrainInfo(_payload.name);
    const prepareConstraintCreation = await this.prepareConstrainInformation(
      _payload.name,
      partitionInsertionStatus,
      currentConstraint
    );

    if (!prepareConstraintCreation) {
      this.logger.info(
        "Current partition is not done and already having constraint or already having full constraint, so don't need to create constraint",
        _payload.name
      );
      return this.createConstraintTxMsgStatus.currentPartitionDoneOrInserting;
    }

    await this.createConstraint(
      _payload.name,
      prepareConstraintCreation.createConstraint.fromTxId,
      prepareConstraintCreation.createConstraint.toTxId,
      prepareConstraintCreation.dropConstraint
    );
    return this.createConstraintTxMsgStatus.constraintUpdated;
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CHECK_TRANSACTION_MESSAGE_CONSTRAINT,
    jobName: BULL_JOB_NAME.JOB_CHECK_TRANSACTION_MESSAGE_CONSTRAINT,
  })
  public async createConstraintInTxMsgPartition() {
    const listPartition = await this.getTxMsgPartitionInfo();
    listPartition.forEach(
      (partition: { name: string; fromId: string; toId: string }) => {
        this.createJob(
          BULL_JOB_NAME.JOB_CREATE_TRANSACTION_MESSAGE_CONSTRAINT,
          BULL_JOB_NAME.JOB_CREATE_TRANSACTION_MESSAGE_CONSTRAINT,
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
      BULL_JOB_NAME.JOB_CHECK_TRANSACTION_MESSAGE_CONSTRAINT,
      BULL_JOB_NAME.JOB_CHECK_TRANSACTION_MESSAGE_CONSTRAINT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every:
            config.jobCreateConstraintInTransactionMessagePartition
              .jobRepeatCheckNeedCreateConstraint.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
