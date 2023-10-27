/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.JobService.SummarizeBrinIndex.key,
  version: 1,
})
export default class JobSummarizeBrinIndex extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_SUMMARIZE_BRIN_INDEX_IN_TABLE,
    jobName: BULL_JOB_NAME.JOB_SUMMARIZE_BRIN_INDEX_IN_TABLE,
  })
  async summarizeBrinIndexInTable(_payload: {
    table: string;
    tableConfigName: string;
    isPartitionTable: boolean;
  }) {
    this.logger.info(
      `Job summarize brin index in table ${_payload.table} start`
    );
    let listIndex = [];
    // if this is partition table, get all index from all partition
    if (_payload.isPartitionTable) {
      const listChilds = await this.getAllChildTable(_payload.table);
      listIndex = await knex.raw(
        `select * from pg_indexes where tablename in (${listChilds
          .map(() => '?')
          .join(',')}) and indexname similar to ?`,
        [
          ...listChilds,
          config.jobSummarizeBrinIndex[_payload.tableConfigName]
            .indexNamePattern,
        ]
      );
    } else {
      listIndex = await knex.raw(
        'select * from pg_indexes where tablename = :tableName and indexname similar to :indexNamePattern',
        {
          tableName: _payload.table,
          indexNamePattern:
            config.jobSummarizeBrinIndex[_payload.tableConfigName]
              .indexNamePattern,
        }
      );
    }

    if (listIndex.rows.length === 0) {
      this.logger.error('Index not found');
    }
    // eslint-disable-next-line no-restricted-syntax
    for await (const row of listIndex.rows) {
      const indexName = row.indexname;
      const resultSummarize = await knex.raw(
        'select brin_summarize_new_values(:indexName)',
        {
          indexName,
        }
      );
      this.logger.info(
        `Job summarize brin index ${indexName} in table ${_payload.table} end, result: ${resultSummarize.rows[0].brin_summarize_new_values}`
      );
    }
  }

  async getAllChildTable(parentTableName: string): Promise<string[]> {
    const result = await knex.raw(
      `SELECT
        nmsp_parent.nspname AS parent_schema,
        parent.relname      AS parent,
        nmsp_child.nspname  AS child_schema,
        child.relname       AS child
      FROM pg_inherits
        JOIN pg_class parent            ON pg_inherits.inhparent = parent.oid
        JOIN pg_class child             ON pg_inherits.inhrelid   = child.oid
        JOIN pg_namespace nmsp_parent   ON nmsp_parent.oid  = parent.relnamespace
        JOIN pg_namespace nmsp_child    ON nmsp_child.oid   = child.relnamespace
      WHERE parent.relname= :parentTableName`,
      {
        parentTableName,
      }
    );
    const listChilds = result.rows.map((row: any) => row.child);
    return listChilds;
  }

  async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.JOB_SUMMARIZE_BRIN_INDEX_IN_TABLE,
      BULL_JOB_NAME.JOB_SUMMARIZE_BRIN_INDEX_IN_TABLE,
      {
        table: 'transaction',
        tableConfigName: 'transactionTable',
      },
      {
        jobId: 'transaction',
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every:
            config.jobSummarizeBrinIndex.transactionTable.milisecondInterval,
        },
        attempts: config.jobRetryAttempt,
        backoff: config.jobRetryBackoff,
      }
    );
    this.createJob(
      BULL_JOB_NAME.JOB_SUMMARIZE_BRIN_INDEX_IN_TABLE,
      BULL_JOB_NAME.JOB_SUMMARIZE_BRIN_INDEX_IN_TABLE,
      {
        table: 'event',
        tableConfigName: 'eventTable',
      },
      {
        jobId: 'event',
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobSummarizeBrinIndex.eventTable.milisecondInterval,
        },
        attempts: config.jobRetryAttempt,
        backoff: config.jobRetryBackoff,
      }
    );
    this.createJob(
      BULL_JOB_NAME.JOB_SUMMARIZE_BRIN_INDEX_IN_TABLE,
      BULL_JOB_NAME.JOB_SUMMARIZE_BRIN_INDEX_IN_TABLE,
      {
        table: 'event_attribute',
        tableConfigName: 'eventAttributePartitionTable',
        isPartitionTable: true,
      },
      {
        jobId: 'event_attribute',
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every:
            config.jobSummarizeBrinIndex.eventAttributePartitionTable
              .milisecondInterval,
        },
        attempts: config.jobRetryAttempt,
        backoff: config.jobRetryBackoff,
      }
    );
    return super._start();
  }
}
