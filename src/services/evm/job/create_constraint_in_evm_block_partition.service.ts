/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import BullableService, { QueueHandler } from '../../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../constant';
import knex from '../../../common/utils/db_connection';
import config from '../../../../config.json' assert { type: 'json' };
import { EVMBlock } from '../../../models';

@Service({
  name: SERVICE.V1.JobService.CreateConstraintInEVMBlockPartition.key,
  version: 1,
})
export default class CreateConstraintInEVMBlockPartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  public createConstraintEVMBlockStatus = {
    currentPartitionEmpty: 'currentPartitionEmpty',
    currentPartitionDoneOrInserting: 'currentPartitionDoneOrInserting',
    constraintUpdated: 'constraintUpdated',
  };

  public insertionStatus = {
    empty: 'empty',
    done: 'done',
    inserting: 'inserting',
  };

  public async getLatestEVMBlockByPartition(
    partitionName: string
  ): Promise<EVMBlock> {
    const latestEVMBlock = await knex.raw(`
      SELECT * FROM ${partitionName} ORDER BY height DESC LIMIT 1
    `);
    return latestEVMBlock.rows[0];
  }

  /**
   * @description get max min height in partition
   * @param partitionName
   */
  public async getMaxMinHeightByPartition(partitionName: string): Promise<{
    min_height: number;
    max_height: number;
  }> {
    await knex.raw(
      `set statement_timeout to ${config.jobCreateConstraintInEVMBlockPartition.statementTimeout}`
    );
    const boundariesResult = await knex.raw(
      `SELECT min(height) min_height, max(height) max_height FROM ${partitionName}`
    );
    return {
      min_height: boundariesResult.rows[0].min_height,
      max_height: boundariesResult.rows[0].max_height,
    };
  }

  /**
   * @description Check partition insertion is done or inserting or empty
   * @param partitionName
   * @param toHeight
   * @public
   */
  public async getPartitionInsertionInfo(
    partitionName: string,
    toHeight: string
  ): Promise<string> {
    const latestEVMBlockPartition = await this.getLatestEVMBlockByPartition(
      partitionName
    );

    if (!latestEVMBlockPartition) return this.insertionStatus.empty;

    const endValueOfPartition = BigNumber(toHeight).minus(1);

    if (endValueOfPartition.eq(latestEVMBlockPartition.height))
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
        WHERE conrelid = '${partitionName}'::regclass and conname like 'evmblock_ct%'
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

    const maxMinHeight = await this.getMaxMinHeightByPartition(partitionName);

    if (insertionStatus === this.insertionStatus.inserting) {
      // Current inserting and having constraint so do nothing
      if (currentConstraintName) return null;

      return {
        createConstraint: {
          fromHeight: maxMinHeight.min_height,
          toHeight: null,
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
        fromHeight: maxMinHeight.min_height,
        toHeight: maxMinHeight.max_height,
      },
      dropConstraint: currentConstraintName,
    };
  }

  /**
   * @description Get list partition of block table
   */
  public async getEVMBlockPartitionInfo(): Promise<
    {
      name: string;
      fromHeight: string;
      toHeight: string;
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
        WHERE parent.relname = 'evm_block';
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
    fromHeight: number,
    toHeight: number | null,
    currentConstraintName: string
  ): Promise<void> {
    let constraintName: string;
    let checkConstraint: string;

    if (toHeight === null) {
      constraintName = `evmblock_ct_${partitionName}_${this.insertionStatus.inserting}`;
      checkConstraint = `(height >= ${fromHeight})`;
    } else {
      constraintName = `evmblock_ct_${partitionName}_${this.insertionStatus.done}`;
      checkConstraint = `(height >= ${fromHeight} AND height <= ${toHeight})`;
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
    queueName: BULL_JOB_NAME.JOB_CREATE_EVM_BLOCK_CONSTRAINT,
    jobName: BULL_JOB_NAME.JOB_CREATE_EVM_BLOCK_CONSTRAINT,
  })
  public async createEVMBlockConstraint(_payload: {
    name: string;
    fromHeight: string;
    toHeight: string;
  }): Promise<string> {
    const partitionInsertionStatus = await this.getPartitionInsertionInfo(
      _payload.name,
      _payload.toHeight
    );
    if (partitionInsertionStatus === this.insertionStatus.empty) {
      this.logger.info(
        "Current partition is empty, so don't need to create constraint",
        _payload.name
      );
      return this.createConstraintEVMBlockStatus.currentPartitionEmpty;
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
      return this.createConstraintEVMBlockStatus
        .currentPartitionDoneOrInserting;
    }

    await this.createConstraint(
      _payload.name,
      prepareConstraintCreation.createConstraint.fromHeight,
      prepareConstraintCreation.createConstraint.toHeight,
      prepareConstraintCreation.dropConstraint
    );
    return this.createConstraintEVMBlockStatus.constraintUpdated;
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CHECK_EVM_BLOCK_CONSTRAINT,
    jobName: BULL_JOB_NAME.JOB_CHECK_EVM_BLOCK_CONSTRAINT,
  })
  public async createConstraintInEVMBlockPartition() {
    const listPartition = await this.getEVMBlockPartitionInfo();
    listPartition.forEach(
      (partition: { name: string; fromHeight: string; toHeight: string }) => {
        this.createJob(
          BULL_JOB_NAME.JOB_CHECK_EVM_BLOCK_CONSTRAINT,
          BULL_JOB_NAME.JOB_CHECK_EVM_BLOCK_CONSTRAINT,
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
      BULL_JOB_NAME.JOB_CHECK_EVM_BLOCK_CONSTRAINT,
      BULL_JOB_NAME.JOB_CHECK_EVM_BLOCK_CONSTRAINT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every:
            config.jobCreateConstraintInEVMBlockPartition
              .jobRepeatCheckNeedCreateConstraint.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
