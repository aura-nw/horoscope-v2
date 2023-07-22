import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import _ from 'lodash';
import { BlockCheckpoint, TransactionMessage } from '../../models';
import { BULL_JOB_NAME, MSG_TYPE, SERVICE } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';

@Service({
  name: SERVICE.V1.HandleAuthzTx.key,
  version: 1,
})
export default class HandleAuthzTxService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  async handleJob() {
    const [startBlock, endBlock, blockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_AUTHZ_TX,
        [BULL_JOB_NAME.HANDLE_TRANSACTION],
        config.handleAuthzTx.key
      );
    this.logger.info(
      `Handle Authz Message from block ${startBlock} to block ${endBlock}`
    );
    if (startBlock > endBlock) {
      return;
    }

    // query numberOfRow tx message has type authz and has no parent_id
    const listTxMsgs = await TransactionMessage.query()
      .joinRelated('transaction')
      .where('height', '>', startBlock)
      .andWhere('height', '<=', endBlock)
      .andWhere('type', MSG_TYPE.MSG_AUTHZ_EXEC)
      .andWhere('parent_id', null);
    const listSubTxAuthz: TransactionMessage[] = [];

    listTxMsgs.forEach(async (txMsg) => {
      this.logger.debug('Handling tx msg id: ', txMsg.id);
      txMsg?.content?.msgs.forEach(async (msg: any, index: number) => {
        listSubTxAuthz.push(
          TransactionMessage.fromJson({
            tx_id: txMsg.tx_id,
            index,
            type: msg['@type'],
            content: msg,
            parent_id: txMsg.id,
            sender: txMsg.sender,
          })
        );
      });
    });
    await knex.transaction(async (trx) => {
      if (listSubTxAuthz.length > 0) {
        await TransactionMessage.query()
          .insert(listSubTxAuthz)
          .transacting(trx);
      }

      if (blockCheckpoint) {
        blockCheckpoint.height = endBlock;

        await BlockCheckpoint.query()
          .insert(blockCheckpoint)
          .onConflict('job_name')
          .merge()
          .returning('id')
          .transacting(trx);
      }
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
    jobName: BULL_JOB_NAME.HANDLE_AUTHZ_TX,
    // prefix: `horoscope-v2-${config.chainId}`,
  })
  async jobHandler() {
    await this.handleJob();
  }

  public async _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.HANDLE_AUTHZ_TX,
      BULL_JOB_NAME.HANDLE_AUTHZ_TX,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.handleAuthzTx.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
