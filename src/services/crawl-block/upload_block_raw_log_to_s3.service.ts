/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import Utils from '../../common/utils/utils';
import { Block, BlockCheckpoint } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { Config, BULL_JOB_NAME, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';
import { S3Service } from '../../common/utils/s3';

const s3Client = S3Service.connectS3();
@Service({
  name: SERVICE.V1.UploadBlockRawLogToS3.key,
  version: 1,
})
export default class UploadBlockRawLogToS3 extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.UPLOAD_BLOCK_RAW_LOG_TO_S3,
    jobName: BULL_JOB_NAME.UPLOAD_BLOCK_RAW_LOG_TO_S3,
  })
  async uplodaBlockRawLogToS3() {
    const [startBlock, endBlock, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.UPLOAD_BLOCK_RAW_LOG_TO_S3,
        [BULL_JOB_NAME.CRAWL_BLOCK],
        config.uploadBlockRawLogToS3.key
      );
    if (startBlock > endBlock) {
      return;
    }
    this.logger.info(`startBlock: ${startBlock} to endBlock: ${endBlock}`);
    const listBlock = await Block.query()
      .select('height', 'hash', 'data')
      .where('height', '>', startBlock)
      .andWhere('height', '<=', endBlock);
    const resultUploadS3 = (
      await Promise.all(
        listBlock.map((block) =>
          Utils.uploadDataToS3(
            block.height.toString(),
            s3Client,
            `rawlog/${config.chainName}/${config.chainId}/block/${block.height}`,
            'application/json',
            Buffer.from(JSON.stringify(block.data)),
            Config.BUCKET,
            Config.S3_GATEWAY,
            config.uploadBlockRawLogToS3.overwriteS3IfFound
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
          `UPDATE block SET data = temp.data from (VALUES ${stringListUpdate}) as temp(height, data) where temp.height = block.height`
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
      BULL_JOB_NAME.UPLOAD_BLOCK_RAW_LOG_TO_S3,
      BULL_JOB_NAME.UPLOAD_BLOCK_RAW_LOG_TO_S3,
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
