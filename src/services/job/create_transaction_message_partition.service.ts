import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import BigNumber from 'bignumber.js';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import { TransactionMessage } from '../../models';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.JobService.CreateTransactionMessagePartition.key,
  version: 1,
})
export default class CreateTransactionMessagePartitionJob extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  /**
   * @description build partitionName by max id in transaction message table, then check partition exist or not.
   * partition exist then do nothing, partition not exist then return partition info that need to be created
   * @param latestTransaction
   */
  public async createPartitionName(
    latestTransactionMessage: TransactionMessage | undefined
  ): Promise<{
    fromTransactionMessageId: string;
    toTransactionMessageId: string;
    partitionName: string;
  } | null> {
    if (
      !latestTransactionMessage ||
      BigNumber(latestTransactionMessage.id)
        .mod(config.migrationTransactionMessageToPartition.step)
        .lt(config.migrationTransactionMessageToPartition.step / 2)
    )
      return null;

    // Calculate current partition step then add 1 step for feature partition creation
    const stepMultiple =
      Math.floor(
        BigNumber(latestTransactionMessage.id)
          .div(config.migrationTransactionMessageToPartition.step)
          .toNumber()
      ) + 1;

    // Build partition name
    const fromTxMsgId = BigNumber(
      config.migrationTransactionMessageToPartition.step
    ).multipliedBy(stepMultiple);
    const toTxMsgId = fromTxMsgId.plus(
      config.migrationTransactionMessageToPartition.step
    );
    const partitionName = `transaction_message_partition_${fromTxMsgId.toString()}_${toTxMsgId.toString()}`;

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
      fromTransactionMessageId: fromTxMsgId.toString(),
      toTransactionMessageId: toTxMsgId.toString(),
      partitionName,
    };
  }

  /**
   * @description: Create partition and attach to table.
   * @param partitionInfo
   */
  public async createPartitionByPartitionInfo(partitionInfo: {
    fromTransactionMessageId: string;
    toTransactionMessageId: string;
    partitionName: string;
  }): Promise<void> {
    await knex.transaction(async (trx) => {
      await knex
        .raw(
          `
            CREATE TABLE ${partitionInfo.partitionName}
            (LIKE ${config.jobCheckNeedCreateTransactionMessagePartition.templateTable} INCLUDING ALL EXCLUDING CONSTRAINTS)
        `
        )
        .transacting(trx);
      await knex
        .raw(
          `
            ALTER TABLE transaction_message ATTACH PARTITION ${partitionInfo.partitionName}
            FOR VALUES FROM (${partitionInfo.fromTransactionMessageId}) to (${partitionInfo.toTransactionMessageId})
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
    queueName: BULL_JOB_NAME.JOB_CREATE_TRANSACTION_MESSAGE_PARTITION,
    jobName: BULL_JOB_NAME.JOB_CREATE_TRANSACTION_MESSAGE_PARTITION,
  })
  async jobCreateTransactionMessagePartition(): Promise<boolean> {
    const latestTransactionMessage = await TransactionMessage.query()
      .limit(1)
      .orderBy('id', 'DESC')
      .first();
    const partitionInfo = await this.createPartitionName(
      latestTransactionMessage
    );

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
      BULL_JOB_NAME.JOB_CREATE_TRANSACTION_MESSAGE_PARTITION,
      BULL_JOB_NAME.JOB_CREATE_TRANSACTION_MESSAGE_PARTITION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every:
            config.jobCheckNeedCreateTransactionMessagePartition
              .millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
