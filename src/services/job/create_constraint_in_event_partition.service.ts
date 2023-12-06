/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import { Event } from '../../models';

@Service({
  name: SERVICE.V1.JobService.CreateConstraintInEventPartition.key,
  version: 1,
})
export default class CreateConstraintInEventPartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  public insertionStatus = {
    empty: 'empty',
    done: 'done',
    inserting: 'inserting',
  };

  public async getLatestEventByPartition(
    partitionName: string
  ): Promise<Event> {
    const latestEvent = await knex.raw(`
      SELECT * FROM ${partitionName} ORDER BY id DESC LIMIT 1
    `);
    return latestEvent.rows[0];
  }

  /**
   * @description get max min tx_id and max min block height in partition
   * @param partitionName
   */
  public async getMaxMinTxIdAndBlhByPartition(partitionName: string): Promise<{
    min_tx_id: number;
    max_tx_id: number;
    min_height: number;
    max_height: number;
  }> {
    await knex.raw(
      `set statement_timeout to ${config.jobCreateConstraintInEventPartition.statementTimeout}`
    );
    const boundariesResult = await knex.raw(`
        SELECT
            min(tx_id) min_tx_id, max(tx_id) max_tx_id, min(block_height) min_height, max(block_height) max_height
        FROM ${partitionName}`);

    return {
      min_tx_id: boundariesResult.rows[0].min_tx_id,
      max_tx_id: boundariesResult.rows[0].max_tx_id,
      min_height: boundariesResult.rows[0].min_height,
      max_height: boundariesResult.rows[0].max_height,
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
    const latestEventPartition = await this.getLatestEventByPartition(
      partitionName
    );

    if (!latestEventPartition) return this.insertionStatus.empty;

    const endValueOfPartition = BigNumber(toId).minus(1);

    if (endValueOfPartition.eq(latestEventPartition.id))
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
        WHERE conrelid = '${partitionName}'::regclass and conname like 'event_constraint%'
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

    const maxMinTxIdAndBlockHeight = await this.getMaxMinTxIdAndBlhByPartition(
      partitionName
    );

    if (insertionStatus === this.insertionStatus.inserting) {
      // Current inserting and having constraint so do nothing
      if (currentConstraintName) return null;

      return {
        createConstraint: {
          fromTxId: maxMinTxIdAndBlockHeight.min_tx_id,
          toTxId: null,
          fromHeight: maxMinTxIdAndBlockHeight.min_height,
          toHeight: null,
        },
        dropConstraint: null,
      };
    }

    // Naming like constraintName_status, so pop() will get current status of constraint
    const constraintStatus = currentConstraintName.split('_').pop();
    // Current done and having full constraint so do nothing
    if (constraintStatus === this.insertionStatus.done) return null;

    return {
      createConstraint: {
        fromTxId: maxMinTxIdAndBlockHeight.min_tx_id,
        toTxId: maxMinTxIdAndBlockHeight.max_tx_id,
        fromHeight: maxMinTxIdAndBlockHeight.min_height,
        toHeight: maxMinTxIdAndBlockHeight.max_height,
      },
      dropConstraint: currentConstraintName,
    };
  }

  /**
   * @description Get list partition of event table
   */
  public async getEventPartitionInfo(): Promise<
    {
      partitionName: string;
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
        WHERE parent.relname = 'event';
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
    fromHeight: number,
    toHeight: number | null,
    currentConstraintName: string
  ): Promise<void> {
    let constraintName: string;
    let checkConstraint: string;

    if (toTxId === null) {
      constraintName = `event_constraint_${this.insertionStatus.inserting}`;
      checkConstraint = `(tx_id >= ${fromTxId} AND block_height >= ${fromHeight})`;
    } else {
      constraintName = `event_constraint_${this.insertionStatus.done}`;
      checkConstraint = `(tx_id >= ${fromTxId} AND tx_id <= ${toTxId} AND block_height >= ${fromHeight} AND block_height <= ${toHeight})`;
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
    queueName: BULL_JOB_NAME.JOB_CREATE_EVENT_CONSTRAIN,
    jobName: BULL_JOB_NAME.JOB_CREATE_EVENT_CONSTRAIN,
  })
  public async createEventConstraint(_payload: {
    name: string;
    fromId: string;
    toId: string;
  }): Promise<void> {
    const partitionInsertionStatus = await this.getPartitionInsertionInfo(
      _payload.name,
      _payload.toId
    );
    if (partitionInsertionStatus === this.insertionStatus.empty) {
      this.logger.info(
        "Current partition is empty, so don't need to create constraint",
        _payload.name
      );
      return;
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
      return;
    }

    await this.createConstraint(
      _payload.name,
      prepareConstraintCreation.createConstraint.fromTxId,
      prepareConstraintCreation.createConstraint.toTxId,
      prepareConstraintCreation.createConstraint.fromHeight,
      prepareConstraintCreation.createConstraint.toHeight,
      prepareConstraintCreation.dropConstraint
    );
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CHECK_EVENT_CONSTRAINT,
    jobName: BULL_JOB_NAME.JOB_CHECK_EVENT_CONSTRAINT,
  })
  public async createConstraintInEventPartition() {
    const listPartition = await this.getEventPartitionInfo();
    listPartition.forEach((partition: any) => {
      this.createJob(
        BULL_JOB_NAME.JOB_CREATE_EVENT_CONSTRAIN,
        BULL_JOB_NAME.JOB_CREATE_EVENT_CONSTRAIN,
        partition,
        {
          jobId: partition.name,
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
        }
      );
    });
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.JOB_CHECK_EVENT_CONSTRAINT,
      BULL_JOB_NAME.JOB_CHECK_EVENT_CONSTRAINT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every:
            config.jobCreateConstraintInEventPartition
              .jobRepeatCheckNeedCreateConstraint.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
