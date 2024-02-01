import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import { Block } from '../../models';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.JobService.CreateBlockPartition.key,
  version: 1,
})
export default class CreateBlockPartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  /**
   * @description build partitionName by max height in block table, then check partition exist or not.
   * partition exist then do nothing, partition not exist then return partition info that need to be created
   * @param latestBlock
   */
  public async createPartitionName(latestBlock: Block | undefined): Promise<{
    fromHeight: string;
    toHeight: string;
    partitionName: string;
  } | null> {
    if (
      !latestBlock ||
      BigNumber(latestBlock.height)
        .mod(config.migrationBlockToPartition.step)
        .lt(config.migrationBlockToPartition.step / 2)
    )
      return null;

    // Calculate current partition step then add 1 step for feature partition creation
    const stepMultiple =
      Math.floor(
        BigNumber(latestBlock.height)
          .div(config.migrationBlockToPartition.step)
          .toNumber()
      ) + 1;

    // Build partition name
    const fromHeight = BigNumber(
      config.migrationBlockToPartition.step
    ).multipliedBy(stepMultiple);
    const toHeight = fromHeight.plus(config.migrationBlockToPartition.step);
    const partitionName = `block_partition_${fromHeight.toString()}_${toHeight.toString()}`;

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
      fromHeight: fromHeight.toString(),
      toHeight: toHeight.toString(),
      partitionName,
    };
  }

  /**
   * @description: Create partition and attach to table.
   * @param partitionInfo
   */
  public async createPartitionByPartitionInfo(partitionInfo: {
    fromHeight: string;
    toHeight: string;
    partitionName: string;
  }): Promise<void> {
    await knex.transaction(async (trx) => {
      await knex
        .raw(
          `
            CREATE TABLE ${partitionInfo.partitionName}
            (LIKE ${config.jobCheckNeedCreateBlockPartition.templateTable} INCLUDING ALL EXCLUDING CONSTRAINTS)
        `
        )
        .transacting(trx);
      await knex
        .raw(
          `
            ALTER TABLE block ATTACH PARTITION ${partitionInfo.partitionName}
            FOR VALUES FROM (${partitionInfo.fromHeight}) to (${partitionInfo.toHeight})
        `
        )
        .transacting(trx);
    });
  }

  /**
   * @description: Job create partition for feature block table
   * Return false if we don't need to create partition for moment
   * Return true if new partition created
   */
  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CREATE_BLOCK_PARTITION,
    jobName: BULL_JOB_NAME.JOB_CREATE_BLOCK_PARTITION,
  })
  async jobCreateBlockPartition(): Promise<boolean> {
    const latestBlock = await Block.query()
      .limit(1)
      .orderBy('height', 'DESC')
      .first();
    const partitionInfo = await this.createPartitionName(latestBlock);

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
      BULL_JOB_NAME.JOB_CREATE_BLOCK_PARTITION,
      BULL_JOB_NAME.JOB_CREATE_BLOCK_PARTITION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobCheckNeedCreateBlockPartition.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
