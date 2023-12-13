import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import { Transaction } from '../../models';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.JobService.CreateTransactionPartition.key,
  version: 1,
})
export default class CreateTransactionPartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  /**
   * @description build partitionName by max id in transaction table, then check partition exist or not.
   * partition exist then do nothing, partition not exist then return partition info that need to be created
   * @param latestTransaction
   */
  public async createPartitionName(
    latestTransaction: Transaction | undefined
  ): Promise<{
    fromTransactionId: string;
    toTransactionId: string;
    partitionName: string;
  } | null> {
    if (
      !latestTransaction ||
      BigNumber(latestTransaction.id)
        .mod(config.migrationTransactionToPartition.step)
        .lt(config.migrationTransactionToPartition.step / 2)
    )
      return null;

    // Calculate current partition step then add 1 step for feature partition creation
    const stepMultiple =
      Math.floor(
        BigNumber(latestTransaction.id)
          .div(config.migrationTransactionToPartition.step)
          .toNumber()
      ) + 1;

    // Build partition name
    const fromTxId = BigNumber(
      config.migrationTransactionToPartition.step
    ).multipliedBy(stepMultiple);
    const toTxId = fromTxId.plus(config.migrationTransactionToPartition.step);
    const partitionName = `transaction_partition_${fromTxId.toString()}_${toTxId.toString()}`;

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
      fromTransactionId: fromTxId.toString(),
      toTransactionId: toTxId.toString(),
      partitionName,
    };
  }

  /**
   * @description: Create partition and attach to table.
   * @param partitionInfo
   */
  public async createPartitionByPartitionInfo(partitionInfo: {
    fromTransactionId: string;
    toTransactionId: string;
    partitionName: string;
  }): Promise<void> {
    await knex.transaction(async (trx) => {
      await knex
        .raw(
          `
            CREATE TABLE ${partitionInfo.partitionName}
            (LIKE ${config.jobCheckNeedCreateTransactionPartition.templateTable} INCLUDING ALL EXCLUDING CONSTRAINTS)
        `
        )
        .transacting(trx);
      await knex
        .raw(
          `
            ALTER TABLE transaction ATTACH PARTITION ${partitionInfo.partitionName}
            FOR VALUES FROM (${partitionInfo.fromTransactionId}) to (${partitionInfo.toTransactionId})
        `
        )
        .transacting(trx);
    });
  }

  /**
   * @description: Job create partition for feature transaction
   * Return false if we don't need to create partition for moment
   * Return true if new partition created
   */
  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_CREATE_TRANSACTION_PARTITION,
    jobName: BULL_JOB_NAME.JOB_CREATE_TRANSACTION_PARTITION,
  })
  async jobCreateTransactionPartition(): Promise<boolean> {
    const latestTransaction = await Transaction.query()
      .limit(1)
      .orderBy('id', 'DESC')
      .first();
    const partitionInfo = await this.createPartitionName(latestTransaction);

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
      BULL_JOB_NAME.JOB_CREATE_TRANSACTION_PARTITION,
      BULL_JOB_NAME.JOB_CREATE_TRANSACTION_PARTITION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.jobCheckNeedCreateTransactionPartition.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
