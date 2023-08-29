/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { fromBase64, fromUtf8 } from '@cosmjs/encoding';
import { Transaction, EventAttribute, BlockCheckpoint } from '../../models';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import config from '../../../config.json' assert { type: 'json' };
import knex from '../../common/utils/db_connection';
import CrawlTxService from '../crawl-tx/crawl_tx.service';

@Service({
  name: SERVICE.V1.JobService.ReAssignMsgIndexToEvent.key,
  version: 1,
})
export default class JobReAssignMsgIndexToEvent extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  crawlTxService: CrawlTxService = new ServiceBroker({
    logger: true,
  }).createService(CrawlTxService) as CrawlTxService;

  @QueueHandler({
    queueName: BULL_JOB_NAME.JOB_REASSIGN_MSG_INDEX_TO_EVENT,
    jobName: BULL_JOB_NAME.JOB_REASSIGN_MSG_INDEX_TO_EVENT,
  })
  async reassignMsgIndexToEvent(_payload: { lastBlockCrawled: number }) {
    const blockCheckpoint = await BlockCheckpoint.query().findOne({
      job_name: BULL_JOB_NAME.JOB_REASSIGN_MSG_INDEX_TO_EVENT,
    });
    this.logger.info(
      `Re assign msg index start from block ${blockCheckpoint?.height}`
    );
    if (blockCheckpoint?.height === _payload.lastBlockCrawled) {
      return;
    }

    let lastBlock =
      (blockCheckpoint?.height ?? 0) +
      config.jobReassignMsgIndexToEvent.blocksPerCall;
    if (lastBlock > _payload.lastBlockCrawled) {
      lastBlock = _payload.lastBlockCrawled;
    }
    await knex.transaction(async (trx) => {
      const listTx = await Transaction.query()
        .withGraphFetched('events.[attributes]')
        .orderBy('id', 'asc')
        .where('height', '>=', blockCheckpoint?.height ?? 0)
        .andWhere('height', '<', lastBlock)
        .transacting(trx);

      const eventPatches: any[] = [];
      const txPatches: any[] = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const tx of listTx) {
        // get data raw in tx
        const rawData = tx.data;
        // set msg_index to event
        rawData.tx_response.events.forEach((event: any) => {
          // eslint-disable-next-line no-param-reassign
          delete event.msg_index;
        });
        this.crawlTxService.setMsgIndexToEvent(rawData);
        txPatches.push(
          Transaction.query()
            .patch({ data: rawData })
            .where('id', tx.id)
            .transacting(trx)
        );

        const events = tx.events.sort((a: any, b: any) => a.id - b.id);
        for (let index = 0; index < events.length; index += 1) {
          const event = events[index];
          // events.forEach((event: Event, index: number) => {
          const rawEvents = rawData.tx_response.events;
          // check if event in raw is the same as event in db
          if (rawEvents[index].type === event.type) {
            const attributes = event.attributes.sort(
              (a: any, b: any) => a.index - b.index
            );
            const checkIndex = attributes.every((attr: EventAttribute) => {
              const decodedKey = rawEvents[index].attributes[attr.index].key
                ? fromUtf8(
                    fromBase64(rawEvents[index].attributes[attr.index].key)
                  )
                : null;
              const decodedValue = rawEvents[index].attributes[attr.index].value
                ? fromUtf8(
                    fromBase64(rawEvents[index].attributes[attr.index].value)
                  )
                : null;
              return attr.key === decodedKey && attr.value === decodedValue;
            });
            if (!checkIndex) {
              throw new Error('order attribute is wrong');
            } else {
              eventPatches.push(
                knex.raw(
                  'UPDATE EVENT SET tx_msg_index = :tx_msg_index WHERE id = :id',
                  {
                    tx_msg_index: rawEvents[index].msg_index ?? null,
                    id: event.id,
                  }
                )
              );
            }
          } else {
            throw new Error(`order event is wrong, ${event.id}, ${index}`);
          }
        }
      }
      this.logger.info('mapping done');
      await Promise.all(eventPatches);
      this.logger.info('update event done');
      await Promise.all(txPatches);
      this.logger.info('update tx done');

      await BlockCheckpoint.query()
        .update(
          BlockCheckpoint.fromJson({
            job_name: BULL_JOB_NAME.JOB_REASSIGN_MSG_INDEX_TO_EVENT,
            height: lastBlock,
          })
        )
        .where({
          job_name: BULL_JOB_NAME.JOB_REASSIGN_MSG_INDEX_TO_EVENT,
        });
    });
  }

  async _start(): Promise<void> {
    const blockCheckpoint = await BlockCheckpoint.query().findOne({
      job_name: BULL_JOB_NAME.JOB_REASSIGN_MSG_INDEX_TO_EVENT,
    });
    if (!blockCheckpoint) {
      await BlockCheckpoint.query().insert({
        job_name: BULL_JOB_NAME.JOB_REASSIGN_MSG_INDEX_TO_EVENT,
        height: config.crawlBlock.startBlock,
      });
      const crawlBlockCheckpoint = await BlockCheckpoint.query().findOne({
        job_name: BULL_JOB_NAME.CRAWL_BLOCK,
      });

      this.createJob(
        BULL_JOB_NAME.JOB_REASSIGN_MSG_INDEX_TO_EVENT,
        BULL_JOB_NAME.JOB_REASSIGN_MSG_INDEX_TO_EVENT,
        {
          lastBlockCrawled: crawlBlockCheckpoint?.height ?? 0,
        },
        {
          removeOnComplete: true,
          removeOnFail: {
            count: 3,
          },
          repeat: {
            every: config.jobReassignMsgIndexToEvent.millisecondCrawl,
          },
        }
      );
    }
    return super._start();
  }
}
