import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import { EvmEvent } from '../../models';

@Service({
  name: SERVICE.V1.JobService.CreateConstraintInEvmEventPartition.key,
  version: 1,
})
export default class CreateConstraintInEvmEventPartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  public createConstraintEvmEventStatus = {
    currentPartitionEmpty: 'currentPartitionEmpty',
    currentPartitionDoneOrInserting: 'currentPartitionDoneOrInserting',
    constraintUpdated: 'constraintUpdated',
  };

  public insertionStatus = {
    empty: 'empty',
    done: 'done',
    inserting: 'inserting',
  };

  public async getLatestEvmEventByPartition(
    partitionName: string
  ): Promise<EvmEvent> {
    const latestEvmEvent = await knex.raw(`
      SELECT * FROM ${partitionName} ORDER BY id DESC LIMIT 1
    `);
    return latestEvmEvent.rows[0];
  }

  /**
   * @description get max min tx_id and max min block height in partition
   * @param partitionName
   */
  public async getMaxMinIdAndHeightByPartition(partitionName: string): Promise<{
    min_id: number;
    max_id: number;
    min_height: number;
    max_height: number;
  }> {
    await knex.raw(
      `set statement_timeout to ${config.jobCreateConstraintInEvmEventPartition.statementTimeout}`
    );
    const boundariesResult = await knex.raw(`
        SELECT
            min(id) min_id, max(id) max_id, min(block_height) min_height, max(block_height) max_height
        FROM ${partitionName}`);

    return {
      min_id: boundariesResult.rows[0].min_id,
      max_id: boundariesResult.rows[0].max_id,
      min_height: boundariesResult.rows[0].min_height,
      max_height: boundariesResult.rows[0].max_height,
    };
  }

  /**
   * @description get max min tx_id and max min evm_tx_id in partition of evm_event table
   * @param partitionName
   */
  public async getMaxMinTxIdAndEvmTxIdByPartition(
    partitionName: string
  ): Promise<{
    min_tx_id: number;
    max_tx_id: number;
    min_evm_tx_id: number;
    max_evm_tx_id: number;
  }> {
    await knex.raw(
      `set statement_timeout to ${config.jobCreateConstraintInEvmEventPartition.statementTimeout}`
    );
    const boundariesResult = await knex.raw(`
        SELECT
            min(tx_id) min_tx_id, max(tx_id) max_tx_id, min(evm_tx_id) min_evm_tx_id, max(evm_tx_id) max_evm_tx_id
        FROM ${partitionName}`);

    return {
      min_tx_id: boundariesResult.rows[0].min_tx_id,
      max_tx_id: boundariesResult.rows[0].max_tx_id,
      min_evm_tx_id: boundariesResult.rows[0].min_evm_tx_id,
      max_evm_tx_id: boundariesResult.rows[0].max_evm_tx_id,
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
    const latestEvmEventPartition = await this.getLatestEvmEventByPartition(
      partitionName
    );

    if (!latestEvmEventPartition) return this.insertionStatus.empty;

    const endValueOfPartition = BigNumber(toId).minus(1);

    if (endValueOfPartition.eq(latestEvmEventPartition.id))
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
        WHERE conrelid = '${partitionName}'::regclass and conname like 'evm_event_ct%'
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
  ): Promise<{
    createConstraint: { fromHeight: number; toHeight: number | null };
    dropConstraint: string | null;
  } | null> {
    // Don't need to create constraint because current partition is empty
    if (insertionStatus === this.insertionStatus.empty) return null;
    if (
      insertionStatus === this.insertionStatus.inserting &&
      currentConstraintName
    )
      return null;
    // Already has done constraint
    if (currentConstraintName) {
      // Naming like constraintName_status, so pop() will get current status of constraint
      const constraintStatus = currentConstraintName.split('_').pop();
      // Current done and having full constraint so do nothing
      if (constraintStatus === this.insertionStatus.done) return null;
    }

    const maxMinIdAndHeight = await this.getMaxMinIdAndHeightByPartition(
      partitionName
    );

    if (insertionStatus === this.insertionStatus.inserting) {
      return {
        createConstraint: {
          fromHeight: maxMinIdAndHeight.min_height,
          toHeight: null,
        },
        dropConstraint: null,
      };
    }

    return {
      createConstraint: {
        fromHeight: maxMinIdAndHeight.min_height,
        toHeight: maxMinIdAndHeight.max_height,
      },
      dropConstraint: currentConstraintName,
    };
  }

  /**
   * @description Get list partition of evm_event table
   */
  public async getEvmEventPartitionInfo(): Promise<
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
        WHERE parent.relname = '${EvmEvent.tableName}';
    `);
    return partitionTable.rows.map(
      (partition: { bounds: string; child: string }) => ({
        name: partition.child,
        fromId: partition.bounds?.match(/\d+/g)?.[0],
        toId: partition.bounds?.match(/\d+/g)?.[1],
      })
    );
  }

  public async createConstraint(
    partitionName: string,
    fromHeight: number,
    toHeight: number | null,
    currentConstraintName: string | null
  ): Promise<void> {
    let constraintBlockName: string;
    let constraintTxIdName: string;
    let constraintEvmTxIdName: string;
    let checkConstraintBlock: string;
    let checkConstraintTxId: string;
    let checkConstraintEvmTxId: string;

    const maxMinTxIdAndEvmTxId = await this.getMaxMinTxIdAndEvmTxIdByPartition(
      partitionName
    );

    if (toHeight === null) {
      constraintBlockName = `evm_event_ct_${partitionName}_${this.insertionStatus.inserting}`;
      constraintTxIdName = `evm_event_c1_${partitionName}_${this.insertionStatus.inserting}`;
      constraintEvmTxIdName = `evm_event_c2_${partitionName}_${this.insertionStatus.inserting}`;

      checkConstraintBlock = `(block_height >= ${fromHeight})`;
      checkConstraintTxId = `(tx_id >= ${maxMinTxIdAndEvmTxId.min_tx_id})`;
      checkConstraintEvmTxId = `(evm_tx_id >= ${maxMinTxIdAndEvmTxId.min_evm_tx_id})`;
    } else {
      constraintBlockName = `evm_event_ct_${partitionName}_${this.insertionStatus.done}`;
      constraintTxIdName = `evm_event_c1_${partitionName}_${this.insertionStatus.done}`;
      constraintEvmTxIdName = `evm_event_c2_${partitionName}_${this.insertionStatus.done}`;

      checkConstraintBlock = `(block_height >= ${fromHeight} AND block_height <= ${toHeight})`;
      checkConstraintTxId = `(tx_id >= ${maxMinTxIdAndEvmTxId.min_tx_id} AND tx_id <= ${maxMinTxIdAndEvmTxId.max_tx_id})`;
      checkConstraintEvmTxId = `(evm_tx_id >= ${maxMinTxIdAndEvmTxId.min_evm_tx_id} AND evm_tx_id <= ${maxMinTxIdAndEvmTxId.max_evm_tx_id})`;
    }

    await knex.transaction(async (trx) => {
      if (currentConstraintName) {
        this.logger.info(`DROP constraint ${currentConstraintName}`);
        await knex
          .raw(
            `
          ALTER TABLE ${partitionName} DROP CONSTRAINT ${currentConstraintName};
          ALTER TABLE ${partitionName} DROP CONSTRAINT evm_event_c1_${partitionName}_${this.insertionStatus.inserting};
          ALTER TABLE ${partitionName} DROP CONSTRAINT evm_event_c2_${partitionName}_${this.insertionStatus.inserting};
        `
          )
          .transacting(trx);
      }

      await knex
        .raw(
          `
        ALTER TABLE ${partitionName} ADD CONSTRAINT ${constraintBlockName} check ${checkConstraintBlock} not valid;
        ALTER TABLE ${partitionName} ADD CONSTRAINT ${constraintTxIdName} check ${checkConstraintTxId} not valid;
        ALTER TABLE ${partitionName} ADD CONSTRAINT ${constraintEvmTxIdName} check ${checkConstraintEvmTxId} not valid;
      `
        )
        .transacting(trx);

      await knex
        .raw(
          `
        ALTER TABLE ${partitionName} validate constraint ${constraintBlockName};
        ALTER TABLE ${partitionName} validate constraint ${constraintTxIdName};
        ALTER TABLE ${partitionName} validate constraint ${constraintEvmTxIdName};
      `
        )
        .transacting(trx);

      this.logger.info(`Constraint created with name ${constraintBlockName}`);
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CREATE_EVM_EVENT_CONSTRAINT,
    jobName: BULL_JOB_NAME.JOB_CREATE_EVM_EVENT_CONSTRAINT,
  })
  public async createEvmEventConstraint(_payload: {
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
      return this.createConstraintEvmEventStatus.currentPartitionEmpty;
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
      return this.createConstraintEvmEventStatus
        .currentPartitionDoneOrInserting;
    }

    await this.createConstraint(
      _payload.name,
      prepareConstraintCreation.createConstraint.fromHeight,
      prepareConstraintCreation.createConstraint.toHeight,
      prepareConstraintCreation.dropConstraint
    );
    return this.createConstraintEvmEventStatus.constraintUpdated;
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CHECK_EVM_EVENT_CONSTRAINT,
    jobName: BULL_JOB_NAME.JOB_CHECK_EVM_EVENT_CONSTRAINT,
  })
  public async createConstraintInEvmEventPartition() {
    const listPartition = await this.getEvmEventPartitionInfo();
    listPartition.forEach(
      (partition: { name: string; fromId: string; toId: string }) => {
        this.createJob(
          BULL_JOB_NAME.JOB_CREATE_EVM_EVENT_CONSTRAINT,
          BULL_JOB_NAME.JOB_CREATE_EVM_EVENT_CONSTRAINT,
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
      BULL_JOB_NAME.JOB_CHECK_EVM_EVENT_CONSTRAINT,
      BULL_JOB_NAME.JOB_CHECK_EVM_EVENT_CONSTRAINT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every:
            config.jobCreateConstraintInEvmEventPartition
              .jobRepeatCheckNeedCreateConstraint.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
