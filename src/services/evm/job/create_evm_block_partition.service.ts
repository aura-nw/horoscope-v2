import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import BullableService, { QueueHandler } from '../../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../constant';
import knex from '../../../common/utils/db_connection';
import { EVMBlock } from '../../../models';
import config from '../../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.JobService.CreateEVMBlockPartition.key,
  version: 1,
})
export default class CreateEVMBlockPartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  /**
   * @description build partitionName by max height in evm_block table, then check partition exist or not.
   * partition exist then do nothing, partition not exist then return partition info that need to be created
   * @param latestEvmBlock
   */
  public async createPartitionName(
    latestEvmBlock: EVMBlock | undefined
  ): Promise<{
    fromEVMBlockHeight: string;
    toEVMBlockHeight: string;
    partitionName: string;
  } | null> {
    if (
      !latestEvmBlock ||
      BigNumber(latestEvmBlock.height)
        .mod(config.createEvmBlockToPartition.step)
        .lt(config.createEvmBlockToPartition.step / 2)
    )
      return null;

    // Calculate current partition step then add 1 step for feature partition creation
    const stepMultiple =
      Math.floor(
        BigNumber(latestEvmBlock.height)
          .div(config.createEvmBlockToPartition.step)
          .toNumber()
      ) + 1;

    // Build partition name
    const fromEVMBlockHeight = BigNumber(
      config.createEvmBlockToPartition.step
    ).multipliedBy(stepMultiple);
    const toEVMBlockHeight = fromEVMBlockHeight.plus(
      config.createEvmBlockToPartition.step
    );
    const partitionName = `evm_block_partition_${fromEVMBlockHeight.toString()}_${toEVMBlockHeight.toString()}`;

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
      fromEVMBlockHeight: fromEVMBlockHeight.toString(),
      toEVMBlockHeight: toEVMBlockHeight.toString(),
      partitionName,
    };
  }

  /**
   * @description: Create partition and attach to table.
   * @param partitionInfo
   */
  public async createPartitionByPartitionInfo(partitionInfo: {
    fromEVMBlockHeight: string;
    toEVMBlockHeight: string;
    partitionName: string;
  }): Promise<void> {
    await knex.transaction(async (trx) => {
      await knex
        .raw(
          `
            CREATE TABLE ${partitionInfo.partitionName}
            (LIKE ${config.jobCheckNeedCreateEVMBlockPartition.templateTable} INCLUDING ALL EXCLUDING CONSTRAINTS)
        `
        )
        .transacting(trx);
      await knex
        .raw(
          `
            ALTER TABLE evm_block ATTACH PARTITION ${partitionInfo.partitionName}
            FOR VALUES FROM (${partitionInfo.fromEVMBlockHeight}) to (${partitionInfo.toEVMBlockHeight})
        `
        )
        .transacting(trx);
    });
  }

  /**
   * @description: Job create partition
   * Return false if we don't need to create partition for moment
   * Return true if new partition created
   */
  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CREATE_EVM_BLOCK_PARTITION,
    jobName: BULL_JOB_NAME.JOB_CREATE_EVM_BLOCK_PARTITION,
  })
  async jobcreateEvmBlockToPartition(): Promise<boolean> {
    const latestEVMBlock = await EVMBlock.query()
      .limit(1)
      .orderBy('height', 'DESC')
      .first();
    const partitionInfo = await this.createPartitionName(latestEVMBlock);

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
      BULL_JOB_NAME.JOB_CREATE_EVM_BLOCK_PARTITION,
      BULL_JOB_NAME.JOB_CREATE_EVM_BLOCK_PARTITION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobCheckNeedCreateEVMBlockPartition.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
