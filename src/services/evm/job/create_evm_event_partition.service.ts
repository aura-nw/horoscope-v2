import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import BullableService, { QueueHandler } from '../../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../constant';
import knex from '../../../common/utils/db_connection';
import { EvmEvent } from '../../../models';
import config from '../../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.JobService.CreateEvmEventPartition.key,
  version: 1,
})
export default class CreateEvmEventPartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  /**
   * @description build partitionName by max id in evm event table, then check partition exist or not.
   * partition exist then do nothing, partition not exist then return partition info that need to be created
   * @param latestEvmEvent
   */
  public async createPartitionName(
    latestEvmEvent: EvmEvent | undefined
  ): Promise<{
    fromEvmEventId: string;
    toEvmEventId: string;
    partitionName: string;
  } | null> {
    if (
      !latestEvmEvent ||
      BigNumber(latestEvmEvent.id)
        .mod(config.migrationEvmEventToPartition.step)
        .lt(config.migrationEvmEventToPartition.step / 2)
    )
      return null;

    // Calculate current partition step then add 1 step for feature partition creation
    const stepMultiple =
      Math.floor(
        BigNumber(latestEvmEvent.id)
          .div(config.migrationEvmEventToPartition.step)
          .toNumber()
      ) + 1;

    // Build partition name
    const fromEvmEventId = BigNumber(
      config.migrationEvmEventToPartition.step
    ).multipliedBy(stepMultiple);
    const toEvmEventId = fromEvmEventId.plus(
      config.migrationEvmEventToPartition.step
    );
    const partitionName = `${
      EvmEvent.tableName
    }_partition_${fromEvmEventId.toString()}_${toEvmEventId.toString()}`;

    // Check partition exist or not
    const existPartition = await knex.raw(`
      SELECT
        parent.relname AS parent,
        child.relname AS child
      FROM pg_inherits
      JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
      JOIN pg_class child  ON pg_inherits.inhrelid  = child.oid
      WHERE child.relname = '${partitionName}';
    `);

    if (existPartition.rows.length > 0) return null;

    return {
      fromEvmEventId: fromEvmEventId.toString(),
      toEvmEventId: toEvmEventId.toString(),
      partitionName,
    };
  }

  /**
   * @description: Create partition and attach to table.
   * @param partitionInfo
   */
  public async createPartitionByPartitionInfo(partitionInfo: {
    fromEvmEventId: string;
    toEvmEventId: string;
    partitionName: string;
  }): Promise<void> {
    await knex.transaction(async (trx) => {
      await knex
        .raw(
          `
            CREATE TABLE ${partitionInfo.partitionName}
            (LIKE ${config.jobCheckNeedCreateEvmEventPartition.templateTable} INCLUDING ALL EXCLUDING CONSTRAINTS)
        `
        )
        .transacting(trx);
      await knex
        .raw(
          `
            ALTER TABLE ${EvmEvent.tableName} ATTACH PARTITION ${partitionInfo.partitionName}
            FOR VALUES FROM (${partitionInfo.fromEvmEventId}) to (${partitionInfo.toEvmEventId})
        `
        )
        .transacting(trx);
    });
  }

  /**
   * @description: Job create partition for feature evm_event
   * Return false if we don't need to create partition for moment
   * Return true if new partition created
   */
  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CREATE_EVM_EVENT_PARTITION,
    jobName: BULL_JOB_NAME.JOB_CREATE_EVM_EVENT_PARTITION,
  })
  async jobCreateEvmEventPartition(): Promise<boolean> {
    const latestEvmEvent = await EvmEvent.query()
      .limit(1)
      .orderBy('id', 'DESC')
      .first();
    const partitionInfo = await this.createPartitionName(latestEvmEvent);

    if (!partitionInfo) {
      this.logger.info('Dont need to create partition');
      return false;
    }

    this.logger.info('Create partition on table', partitionInfo);
    await this.createPartitionByPartitionInfo(partitionInfo);
    return true;
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.JOB_CREATE_EVM_EVENT_PARTITION,
      BULL_JOB_NAME.JOB_CREATE_EVM_EVENT_PARTITION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobCheckNeedCreateEvmEventPartition.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
