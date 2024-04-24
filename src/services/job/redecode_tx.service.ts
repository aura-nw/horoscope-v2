/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { decodeTxRaw } from '@cosmjs/proto-signing';
import { fromBase64 } from '@cosmjs/encoding';
import axios from 'axios';
import { Transaction, TransactionMessage } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE, Config } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import ChainRegistry from '../../common/utils/chain.registry';
import Utils from '../../common/utils/utils';
import knex from '../../common/utils/db_connection';
import { getProviderRegistry } from '../../common/utils/provider.registry';
import { S3Service } from '../../common/utils/s3';

const s3Client = S3Service.connectS3();

@Service({
  name: SERVICE.V1.JobService.ReDecodeTx.key,
  version: 1,
})
export default class JobRedecodeTx extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_REDECODE_TX,
    jobName: BULL_JOB_NAME.JOB_REDECODE_TX,
  })
  async redecodeTxByType(_payload: { type: string }) {
    this.logger.info('Job re decode tx type: ', _payload.type);
    const providerRegistry = await getProviderRegistry();
    const registry = new ChainRegistry(this.logger, providerRegistry);
    let currentId = 0;
    await knex.transaction(async (trx) => {
      let done = false;
      while (!done) {
        this.logger.info(
          `Re decode tx ${_payload.type} at current id: ${currentId}`
        );
        const txOnDB = await Transaction.query()
          .select(
            'transaction.id',
            'transaction.data',
            'transaction.height',
            'transaction.hash'
          )
          .distinct()
          .joinRelated('messages')
          .where('transaction.id', '>', currentId)
          .andWhere('messages.type', _payload.type)
          .limit(config.jobRedecodeTx.limitRecordGet);

        if (txOnDB.length === 0) {
          done = true;
          break;
        }

        await Promise.all(
          txOnDB
            .filter((tx) => tx.data.linkS3)
            .map((tx) =>
              axios.get(tx.data.linkS3).then((res) => {
                // eslint-disable-next-line no-param-reassign
                tx.data = res.data;
                // eslint-disable-next-line no-param-reassign
                tx.s3NeedUpdateOnly = true;
              })
            )
        );

        const patchQueriesMsg: any[] = [];
        const patchQueriesTx = txOnDB.map((tx) => {
          const decodedTxRaw = decodeTxRaw(fromBase64(tx.data.tx_response.tx));
          const messages = decodedTxRaw.body.messages.map((msg) =>
            Utils.camelizeKeys(registry.decodeMsg(msg))
          );

          // eslint-disable-next-line no-param-reassign
          tx.data.tx.body.messages = messages;
          messages.forEach((msg, index: number) => {
            patchQueriesMsg.push(
              TransactionMessage.query()
                .patch({
                  content: msg,
                })
                .where({
                  tx_id: tx.id,
                  index,
                })
            );
          });
          if (tx.s3NeedUpdateOnly) {
            return Utils.uploadDataToS3(
              tx.id.toString(),
              s3Client,
              `rawlog/${config.chainName}/${config.chainId}/transaction/${tx.height}/${tx.hash}`,
              'application/json',
              Buffer.from(JSON.stringify(tx.data)),
              Config.BUCKET,
              Config.S3_GATEWAY,
              true,
              false
            );
          }
          return Transaction.query()
            .patch({
              data: tx.data,
            })
            .where({ id: tx.id })
            .transacting(trx);
        });

        await Promise.all(patchQueriesTx);
        await Promise.all(patchQueriesMsg);
        currentId = txOnDB[txOnDB.length - 1].id;
      }
    });
  }

  @Action({
    name: SERVICE.V1.JobService.ReDecodeTx.actionCreateJob.key,
    params: {
      type: 'string',
    },
  })
  public async actionCreateJob(ctx: Context<{ type: string }>) {
    this.createJob(
      BULL_JOB_NAME.JOB_REDECODE_TX,
      BULL_JOB_NAME.JOB_REDECODE_TX,
      {
        type: ctx.params.type,
      },
      {
        jobId: ctx.params.type,
        removeOnComplete: false,
        removeOnFail: {
          count: 100,
        },
        attempts: config.jobRetryAttempt,
        backoff: config.jobRetryBackoff,
      }
    );
  }
}
