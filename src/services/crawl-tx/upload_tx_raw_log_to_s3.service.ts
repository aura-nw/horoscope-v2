/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import Utils from '../../common/utils/utils';
import { BlockCheckpoint, Transaction } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config, BULL_JOB_NAME, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';
import { S3Service } from '../../common/utils/s3';

const s3Client = S3Service.connectS3();
@Service({
  name: SERVICE.V1.UploadTxRawLogToS3.key,
  version: 1,
})
export default class UploadTxRawLogToS3 extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.UPLOAD_TX_RAW_LOG_TO_S3,
    jobName: BULL_JOB_NAME.UPLOAD_TX_RAW_LOG_TO_S3,
  })
  async uplodaBlockRawLogToS3() {
    const [startBlock, endBlock, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.UPLOAD_TX_RAW_LOG_TO_S3,
        [BULL_JOB_NAME.HANDLE_TRANSACTION],
        config.uploadBlockRawLogToS3.key
      );
    if (startBlock > endBlock) {
      return;
    }
    this.logger.info(`startBlock: ${startBlock} to endBlock: ${endBlock}`);
    const listTx = await Transaction.query()
      .select('id', 'height', 'hash', 'data')
      .where('height', '>', startBlock)
      .andWhere('height', '<=', endBlock);
    const resultUploadS3 = (
      await Promise.all(
        listTx.map((tx) =>
          Utils.uploadDataToS3(
            tx.id.toString(),
            s3Client,
            `rawlog/${config.chainName}/${config.chainId}/transaction/${tx.height}/${tx.hash}`,
            'application/json',
            Buffer.from(JSON.stringify(tx.data)),
            Config.BUCKET,
            Config.S3_GATEWAY,
            config.uploadTransactionRawLogToS3.overwriteS3IfFound
          )
        )
      ).catch((err) => {
        this.logger.error(err);
        throw err;
      })
    ).filter((e) => e !== undefined);

    const stringListUpdate = resultUploadS3.map(
      (item) =>
        `(${item?.id}, '${JSON.stringify({
          linkS3: item?.key,
        })}'::json)`
    );

    await knex.transaction(async (trx) => {
      if (resultUploadS3.length > 0) {
        await knex.raw(
          `UPDATE transaction SET data = temp.data from (VALUES ${stringListUpdate}) as temp(id, data) where temp.id = transaction.id`
        );
      }

      updateBlockCheckpoint.height = endBlock;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .transacting(trx);
    });
  }

  async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.UPLOAD_TX_RAW_LOG_TO_S3,
      BULL_JOB_NAME.UPLOAD_TX_RAW_LOG_TO_S3,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.uploadBlockRawLogToS3.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
