/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { decodeTxRaw } from '@cosmjs/proto-signing';
import { fromBase64 } from '@cosmjs/encoding';
import { BlockCheckpoint, Transaction, TransactionMessage } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import AuraRegistry from '../crawl-tx/aura.registry';
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

  async redecodeTxByType(type: string) {
    this.logger.info('Job re decode tx ibc');
    const registry = new AuraRegistry(this.logger);
    let currentId = 0;
    await knex.transaction(async (trx) => {
      let done = false;
      while (!done) {
        this.logger.info(`Re decode tx ${type} at current id: ${currentId}`);
        const txOnDB = await Transaction.query()
          .select('transaction.id', 'transaction.data')
          .distinct()
          .joinRelated('messages')
          .where('transaction.id', '>', currentId)
          .andWhere('messages.type', type)
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

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_REDECODE_TX_IBC,
    jobName: BULL_JOB_NAME.JOB_REDECODE_TX_IBC,
  })
  async jobRedecodeTxIBC() {
    // check if job not done, execute as
    const blockCheckpoint = await BlockCheckpoint.query()
      .where({
        job_name: BULL_JOB_NAME.JOB_REDECODE_TX_IBC,
      })
      .findOne({});

    if (!blockCheckpoint || blockCheckpoint.height === 0) {
      this.logger.info('Job redecode tx ibc start');
      await this.redecodeTxByType('/ibc.core.client.v1.MsgCreateClient');
    }
    // mark as job completed
    await BlockCheckpoint.query()
      .insert({
        job_name: BULL_JOB_NAME.JOB_REDECODE_TX_IBC,
        height: 1,
      })
      .onConflict('job_name')
      .merge();
  }

  async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.JOB_REDECODE_TX_IBC,
      BULL_JOB_NAME.JOB_REDECODE_TX_IBC,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
      }
    );
    return super._start();
  }
}
