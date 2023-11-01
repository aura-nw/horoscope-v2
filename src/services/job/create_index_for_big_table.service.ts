import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.JobService.CreateIndexForBigTable.key,
  version: 1,
})
export default class CreateIndexForBigTableJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  public static buildQueryCreateIndex(payload: {
    tableName: string;
    indexName: string;
    indexType: string;
    columnName: string;
    pagesPerRange: number;
    whereClauses?: { column: string; expression: string; condition: string }[];
  }): string {
    let baseQuery = `
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ${payload.indexName}
        ON ${payload.tableName} USING ${payload.indexType} (${payload.columnName})
    `;

    if (payload.pagesPerRange && payload.indexType === 'brin') {
      baseQuery += ` WITH (pages_per_range = ${payload.pagesPerRange})`;
    }

    if (payload.whereClauses && payload.whereClauses.length > 0) {
      let keywordCondition = 'where';
      payload.whereClauses.forEach((whereClause) => {
        baseQuery += ` ${keywordCondition} ${whereClause.column} ${whereClause.expression} ${whereClause.condition}`;
        if (keywordCondition === 'where') keywordCondition = 'and';
      });
    }

    return baseQuery;
  }

  /**
   * @Description: Job create index for big table in CONCURRENTLY MODE
   * @Note: Only support create index, for partitioned table have to input partition name instead of table name
   * @Logic: Create index if not exist in concurrently mode -> then log query have executed
   */
  @QueueHandler({
    queueName: BULL_JOB_NAME.CREATE_IDX_FOR_BIG_TABLE,
    jobName: BULL_JOB_NAME.CREATE_IDX_FOR_BIG_TABLE,
  })
  async createIndexForBigTable(payload: {
    tableName: string;
    indexName: string;
    indexType: string;
    columnName: string;
    pagesPerRange: number;
    whereClauses?: { column: string; expression: string; condition: string }[];
  }) {
    const sql = CreateIndexForBigTableJob.buildQueryCreateIndex(payload);
    this.logger.info(`STARTING: ${sql}`);
    await knex.raw(sql);
    this.logger.info(`DONE: ${sql}`);
  }

  @Action({
    name: SERVICE.V1.JobService.CreateIndexForBigTable.actionCreateJob.key,
    params: {
      tableName: 'string',
      indexName: 'string',
      indexType: 'string',
      columnName: 'string',
      pagesPerRange: {
        type: 'number',
        optional: true,
      },
      whereClauses: {
        type: 'array',
        optional: true,
      },
    },
  })
  public async actionCreateJob(
    ctx: Context<{
      tableName: string;
      indexName: string;
      indexType: string;
      columnName: string;
      pagesPerRange: number;
      whereClauses?: {
        column: string;
        expression: string;
        condition: string;
      }[];
    }>
  ) {
    await this.createJob(
      BULL_JOB_NAME.CREATE_IDX_FOR_BIG_TABLE,
      BULL_JOB_NAME.CREATE_IDX_FOR_BIG_TABLE,
      {
        tableName: ctx.params.tableName,
        indexName: ctx.params.indexName,
        indexType: ctx.params.indexType,
        columnName: ctx.params.columnName,
        pagesPerRange: Number(ctx.params.pagesPerRange),
        whereClauses: ctx.params.whereClauses,
      },
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
  }
}
