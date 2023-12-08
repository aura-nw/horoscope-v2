/* eslint-disable no-await-in-loop */
import {
  Action,
  Service,
} from '@ourparentcenter/moleculer-decorators-extended';
import { Context, ServiceBroker } from 'moleculer';
import { decodeTxRaw } from '@cosmjs/proto-signing';
import { fromBase64 } from '@cosmjs/encoding';
import { Transaction, TransactionMessage } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import SeiRegistry from '../crawl-tx/sei.registry';
import Utils from '../../common/utils/utils';
import knex from '../../common/utils/db_connection';

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
    const registry = new SeiRegistry(this.logger);
    let currentId = 0;
    await knex.transaction(async (trx) => {
      let done = false;
      while (!done) {
        this.logger.info(
          `Re decode tx ${_payload.type} at current id: ${currentId}`
        );
        const txOnDB = await Transaction.query()
          .select('transaction.id', 'transaction.data')
          .distinct()
          .joinRelated('messages')
          .where('transaction.id', '>', currentId)
          .andWhere('messages.type', _payload.type)
          .limit(config.jobRedecodeTx.limitRecordGet);

        if (txOnDB.length === 0) {
          done = true;
          break;
        }

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
