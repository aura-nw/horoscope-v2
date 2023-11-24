import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import { Event } from '../../models';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.JobService.CreateEventPartition.key,
  version: 1,
})
export default class CreateEventPartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  /**
   * @description check should we consider to create partition
   * We create partition when id of event reach to a half id support of current partition
   * like partition from 0 -> 2000, we will create new partition when id reach to 1001
   * @param latestEvent
   */
  public isCreatePartition(latestEvent: Event): boolean {
    return BigNumber(latestEvent.id)
      .mod(config.migrationEventToPartition.step)
      .gte(config.migrationEventToPartition.step / 2);
  }

  /**
   * @description build partitionName by max id in event table, then check partition exist or not. isCreate false if
   * partition exist then do nothing, isCreate true if partition not exist and need to be created
   * @param maxCurrentEventId
   */
  public async createPartitionName(maxCurrentEventId: string): Promise<{
    fromEventId: string;
    toEventId: string;
    partitionName: string;
    isCreate: boolean;
  }> {
    /**
     * @description Calculate current partition step then add 1 step for feature partition creation
     */
    const stepMultiple =
      Math.floor(
        BigNumber(maxCurrentEventId)
          .div(config.migrationEventToPartition.step)
          .toNumber()
      ) + 1;

    /**
     * @description Build partition name
     */
    const minEventIdForNewPartition = BigNumber(
      config.migrationEventToPartition.step
    ).multipliedBy(stepMultiple);
    const maxEventIdForNewPartition = minEventIdForNewPartition.plus(
      config.migrationEventToPartition.step
    );
    const partitionName = `event_partition_${minEventIdForNewPartition.toString()}_${maxEventIdForNewPartition.toString()}`;

    /**
     * @description Check partition exist or not
     */
    const existPartition = await knex.raw(`
      SELECT
        parent.relname AS parent,
        child.relname AS child
      FROM pg_inherits
      JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
      JOIN pg_class child  ON pg_inherits.inhrelid  = child.oid
      WHERE child.relname = '${partitionName}';
    `);

    const partitionInfo = {
      fromEventId: minEventIdForNewPartition.toString(),
      toEventId: maxEventIdForNewPartition.toString(),
      partitionName,
      isCreate: true,
    };

    if (existPartition.rows.length > 0) {
      partitionInfo.isCreate = false;
      return partitionInfo;
    }

    return partitionInfo;
  }

  /**
   * @description: Create partition and attach to table.
   * @param partitionInfo
   */
  public async createPartitionByPartitionInfo(partitionInfo: {
    fromEventId: string;
    toEventId: string;
    partitionName: string;
    isCreate: boolean;
  }): Promise<void> {
    await knex.transaction(async (trx) => {
      await knex
        .raw(
          `
            CREATE TABLE ${partitionInfo.partitionName}
            (LIKE ${config.jobCheckNeedCreateEventPartition.templateTable} INCLUDING ALL EXCLUDING CONSTRAINTS)
        `
        )
        .transacting(trx);
      await knex
        .raw(
          `
            ALTER TABLE event ATTACH PARTITION ${partitionInfo.partitionName}
            FOR VALUES FROM (${partitionInfo.fromEventId}) to (${partitionInfo.toEventId})
        `
        )
        .transacting(trx);
    });
  }

  /**
   * @description: Job create partition for feature event
   * Return false if we don't need to create partition for moment
   * Return true if new partition created
   */
  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CREATE_EVENT_PARTITION,
    jobName: BULL_JOB_NAME.JOB_CREATE_EVENT_PARTITION,
  })
  async jobCreateEventPartition(): Promise<boolean> {
    const latestEvent = await Event.query().findOne({}).orderBy('id', 'DESC');

    if (!latestEvent || !this.isCreatePartition(latestEvent)) {
      this.logger.info('Dont need to create partition');
      return false;
    }

    const partitionInfo = await this.createPartitionName(latestEvent?.id);

    if (!partitionInfo.isCreate) {
      this.logger.info('Partition already existed on table', partitionInfo);
      return false;
    }

    this.logger.info('Create partition on table', partitionInfo);
    await this.createPartitionByPartitionInfo(partitionInfo);
    return true;
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.JOB_CREATE_EVENT_PARTITION,
      BULL_JOB_NAME.JOB_CREATE_EVENT_PARTITION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobCheckNeedCreateEventPartition.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
