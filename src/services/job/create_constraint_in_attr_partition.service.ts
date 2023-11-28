/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import { BlockCheckpoint } from '../../models';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.JobService.CreateConstraintInAttrPartition.key,
  version: 1,
})
export default class CreateConstraintInAttrPartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  statusPartition = {
    running: 'running',
    waiting: 'waiting',
    done: 'done',
  };

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CHECK_NEED_CREATE_CONSTRAINT,
    jobName: BULL_JOB_NAME.JOB_CHECK_NEED_CREATE_CONSTRAINT,
  })
  public async createContraintInAttrPartition() {
    // query all child of parent table
    const partitionTable = await knex.raw(
      `SELECT
        parent.relname      AS parent,
        child.relname       AS child,
      pg_get_expr(child.relpartbound, child.oid) AS bounds
      FROM pg_inherits
          JOIN pg_class parent            ON pg_inherits.inhparent = parent.oid
          JOIN pg_class child             ON pg_inherits.inhrelid   = child.oid
      WHERE parent.relname='event_attribute';`
    );
    // create list partition has height bound and detech its status
    const listPartition = partitionTable.rows.map((partition: any) => {
      const partitionBounds = partition.bounds;
      const heightBound = {
        lower: partitionBounds.match(/\d+/g)[0],
        upper: partitionBounds.match(/\d+/g)[1],
      };
      return {
        name: partition.child,
        heightBound,
      };
    });
    await this.addStatusToPartition(listPartition);

    // create job create constraint for each partition
    listPartition.forEach((partition: any) => {
      this.createJob(
        BULL_JOB_NAME.JOB_CREATE_CONSTRAINT_IN_ATTR_PARTITION,
        BULL_JOB_NAME.JOB_CREATE_CONSTRAINT_IN_ATTR_PARTITION,
        {
          name: partition.name,
          heightBound: partition.heightBound,
          status: partition.status,
        },
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

  /*
   * detect status of partition
   * status = done: crawl block and tx inserted full data to this partition
   * status = waiting: this partition has no data
   * status = running: crawl block and tx still insert data to this partition
   */
  public async addStatusToPartition(listPartition: any[]) {
    const handleTxCheckpoint = await BlockCheckpoint.query().findOne(
      'job_name',
      BULL_JOB_NAME.HANDLE_TRANSACTION
    );
    if (!handleTxCheckpoint) {
      const error = 'Cannot found HANDLE_TRANSACTION block checkpoint';
      this.logger.error(error);
      throw Error(error);
    }
    listPartition.forEach(async (partition) => {
      let statusPartition = this.statusPartition.done;
      if (
        handleTxCheckpoint?.height >= partition.heightBound.lower &&
        handleTxCheckpoint?.height < partition.heightBound.upper
      ) {
        statusPartition = this.statusPartition.running;
      } else if (handleTxCheckpoint?.height > partition.heightBound.upper) {
        statusPartition = this.statusPartition.done;
      } else {
        statusPartition = this.statusPartition.waiting;
      }
      // eslint-disable-next-line no-param-reassign
      partition.status = statusPartition;
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CREATE_CONSTRAINT_IN_ATTR_PARTITION,
    jobName: BULL_JOB_NAME.JOB_CREATE_CONSTRAINT_IN_ATTR_PARTITION,
  })
  public async createConstraintInPartition(_payload: {
    name: string;
    heightBound: { lower: number; upper: number };
    status: string;
  }) {
    this.logger.info(`Creating constraint in partition ${_payload.name}`);
    // regex to check constraint has lower bound only
    const regexLowerBoundOnly = /(?=.*event_id >=)/;
    // regex to check constraint has both lower bound and upper bound
    const regexAll = /(?=.*event_id >=)(?=.*event_id <=)/;
    // check if this partition has check_constraint
    const constraintResult = await knex.raw(
      `select
            connamespace::regnamespace "schema",
            conrelid::regclass "table",
            conname "constraint",
            pg_get_constraintdef(oid) "definition"
        from pg_constraint 
        where conrelid = '${_payload.name}'::regclass and conname like 'check_in_%'`
    );

    // if this partition has lower and upper bound, no need to do anything
    if (
      constraintResult.rows.length > 0 &&
      regexAll.test(constraintResult.rows[0].definition)
    ) {
      return;
    }

    await knex.raw(
      `set statement_timeout to ${config.jobCreateConstraintInAttrPartition.statementTimeout}`
    );
    const boundariesResult = await knex.raw(
      `select min(event_id) min_event_id, max(event_id) max_event_id, min(tx_id) min_tx_id, max(tx_id) max_tx_id from ${_payload.name}`
    );

    const boundaries = {
      min_event_id: boundariesResult.rows[0].min_event_id,
      max_event_id: boundariesResult.rows[0].max_event_id,
      min_tx_id: boundariesResult.rows[0].min_tx_id,
      max_tx_id: boundariesResult.rows[0].max_tx_id,
    };

    if (!boundaries.min_event_id && !boundaries.max_event_id) {
      // this partition has no data
      return;
    }
    const contraintName = `check_in_${_payload.heightBound.lower}_${_payload.heightBound.upper}`;
    const createFullConstraintScript = `(((event_id >= ${boundaries.min_event_id}) AND (event_id <= ${boundaries.max_event_id}) 
    AND (block_height >= ${_payload.heightBound.lower}) AND (block_height < ${_payload.heightBound.upper}) 
    AND (((tx_id >= ${boundaries.min_tx_id}) AND (tx_id <= ${boundaries.max_tx_id})) OR (tx_id IS NULL))))`;
    const createLowerBoundConstraintScript = `(((event_id >= ${boundaries.min_event_id})) AND (block_height >= ${_payload.heightBound.lower}) AND (block_height < ${_payload.heightBound.upper})  AND (((tx_id >= ${boundaries.min_tx_id}) OR (tx_id IS NULL))))`;

    // if this partition has lower bound only
    if (
      constraintResult.rows.length > 0 &&
      regexLowerBoundOnly.test(constraintResult.rows[0].definition)
    ) {
      // if at the moment, this partition has done status, then drop old lower bound constraint and create new full constraint
      if (_payload.status === this.statusPartition.done) {
        // create new constraint has lower bound and upper bound
        const currentContraintName = constraintResult.rows[0].constraint;
        await knex.transaction(async (trx) => {
          await knex
            .raw(`drop constraint ${currentContraintName}`)
            .transacting(trx);
          await knex
            .raw(
              `alter table ${_payload.name} add constraint ${contraintName} check ${createFullConstraintScript}`
            )
            .transacting(trx);
        });
        this.logger.info(
          `Drop and create new constraint in partition ${_payload.name}`
        );
      }
    }

    // if this partition has no check constraint
    if (constraintResult.rows.length === 0) {
      if (_payload.status === this.statusPartition.done) {
        await knex.raw(
          `alter table ${_payload.name} add constraint ${contraintName} check ${createFullConstraintScript}`
        );
        this.logger.info(
          `Creating new full constraint in partition ${_payload.name}`
        );
      } else if (_payload.status === this.statusPartition.running) {
        await knex.raw(
          `alter table ${_payload.name} add constraint ${contraintName} check ${createLowerBoundConstraintScript}`
        );
        this.logger.info(
          `Creating new lower bound constraint in partition ${_payload.name}`
        );
      }
    }
  }

  public async _start(): Promise<void> {
    await this.createContraintInAttrPartition();
    this.createJob(
      BULL_JOB_NAME.JOB_CHECK_NEED_CREATE_CONSTRAINT,
      BULL_JOB_NAME.JOB_CHECK_NEED_CREATE_CONSTRAINT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every:
            config.jobCreateConstraintInAttrPartition
              .jobRepeatCheckNeedCreateConstraint.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
