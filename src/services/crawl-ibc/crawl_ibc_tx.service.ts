import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { raw } from 'objection';
import knex from '../../common/utils/db_connection';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import {
  BlockCheckpoint,
  EventAttribute,
  Event,
  IbcProgress,
} from '../../models';
import config from '../../../config.json' assert { type: 'json' };

@Service({
  name: SERVICE.V1.CrawlIBCService.HandleIBCTxService.key,
  version: 1,
})
export default class CrawlIBCTxService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_IBC_EVENT,
    jobName: BULL_JOB_NAME.HANDLE_IBC_EVENT,
  })
  public async handleIBCEvent(): Promise<void> {
    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_IBC_EVENT,
        [BULL_JOB_NAME.HANDLE_TRANSACTION],
        config.handleIbcEvent.key
      );
    this.logger.info(
      `Handle IBC event, startHeight: ${startHeight}, endHeight: ${endHeight}`
    );
    if (startHeight > endHeight) return;
    const eventAttributes: any[] = await EventAttribute.query()
      .whereIn('key', [
        EventAttribute.ATTRIBUTE_KEY.CLIENT_ID,
        EventAttribute.ATTRIBUTE_KEY.PACKET_SRC_CHANNEL,
        EventAttribute.ATTRIBUTE_KEY.PACKET_SRC_PORT,
        EventAttribute.ATTRIBUTE_KEY.PACKET_CONNECTION,
      ])
      .andWhere('block_height', '>', startHeight)
      .andWhere('block_height', '<=', endHeight)
      .select('event_id', raw('json_object_agg(key, value) as attr'))
      .groupBy('event_id');
    eventAttributes.forEach(async (eventAttribute) => {
      if (eventAttribute.attr[EventAttribute.ATTRIBUTE_KEY.PACKET_CONNECTION]) {
        await this.createJob(
          BULL_JOB_NAME.CRAWL_IBC_CONNECTION_BY_ID,
          BULL_JOB_NAME.CRAWL_IBC_CONNECTION_BY_ID,
          {
            connectionId:
              eventAttribute.attr[
                EventAttribute.ATTRIBUTE_KEY.PACKET_CONNECTION
              ],
          },
          {
            jobId:
              eventAttribute.attr[
                EventAttribute.ATTRIBUTE_KEY.PACKET_CONNECTION
              ],
            removeOnComplete: true,
            removeOnFail: {
              age: 10,
            },
          }
        );
      }
      if (
        eventAttribute.attr[EventAttribute.ATTRIBUTE_KEY.PACKET_SRC_CHANNEL] &&
        eventAttribute.attr[EventAttribute.ATTRIBUTE_KEY.PACKET_SRC_PORT]
      ) {
        await this.createJob(
          BULL_JOB_NAME.CRAWL_IBC_CHANNEL_BY_ID,
          BULL_JOB_NAME.CRAWL_IBC_CHANNEL_BY_ID,
          {
            channelId:
              eventAttribute.attr[
                EventAttribute.ATTRIBUTE_KEY.PACKET_SRC_CHANNEL
              ],
            portId:
              eventAttribute.attr[EventAttribute.ATTRIBUTE_KEY.PACKET_SRC_PORT],
          },
          {
            jobId:
              eventAttribute.attr[
                EventAttribute.ATTRIBUTE_KEY.PACKET_SRC_CHANNEL
              ],
            removeOnComplete: true,
            removeOnFail: {
              age: 10,
            },
          }
        );
      }
      if (eventAttribute.attr[EventAttribute.ATTRIBUTE_KEY.CLIENT_ID]) {
        await this.createJob(
          BULL_JOB_NAME.CRAWL_IBC_CLIENT_BY_ID,
          BULL_JOB_NAME.CRAWL_IBC_CLIENT_BY_ID,
          {
            clientId:
              eventAttribute.attr[EventAttribute.ATTRIBUTE_KEY.CLIENT_ID],
          },
          {
            jobId: eventAttribute.attr[EventAttribute.ATTRIBUTE_KEY.CLIENT_ID],
            removeOnComplete: true,
            removeOnFail: {
              age: 10,
            },
          }
        );
      }
    });

    await knex.transaction(async (trx) => {
      updateBlockCheckpoint.height = endHeight;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id')
        .transacting(trx);
    });
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.HANDLE_IBC_TRANSACTION,
    jobName: BULL_JOB_NAME.HANDLE_IBC_TRANSACTION,
  })
  public async handleIBCTx(): Promise<void> {
    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.HANDLE_IBC_TRANSACTION,
        [BULL_JOB_NAME.HANDLE_IBC_EVENT],
        config.handleIbcTx.key
      );
    this.logger.info(
      `Handle IBC transaction, startHeight: ${startHeight}, endHeight: ${endHeight}`
    );
    if (startHeight > endHeight) return;

    const events: any[] = await Event.query()
      .joinRelated('event_attribute')
      .joinRelated('transaction')
      .select(
        'transaction.hash',
        'event.id',
        'event.type',
        raw('json_object_agg(key, value) as attr')
      )
      .whereIn('type', [
        Event.EVENT_TYPE.SEND_PACKET,
        Event.EVENT_TYPE.RECV_PACKET,
        Event.EVENT_TYPE.ACKNOWLEDGE_PACKET,
        Event.EVENT_TYPE.TIMEOUT_PACKET,
      ])
      .andWhere('event.block_height', '>', startHeight)
      .andWhere('event.block_height', '<=', endHeight)
      .groupBy('transaction.hash', 'event.id', 'event.type');

    await knex.transaction(async (trx) => {
      async function initIBCProgress(
        packetChannel: string,
        packetSequence: string,
        packetData: any
      ) {
        const foundIBCProgress = await IbcProgress.query()
          .where('packet_channel', packetChannel)
          .andWhere('packet_sequence', packetSequence)
          .transacting(trx);
        if (foundIBCProgress.length > 0) {
          return foundIBCProgress[1];
        }
        return IbcProgress.query()
          .insert(
            IbcProgress.fromJson({
              channel_id: packetChannel,
              packet_sequence: packetSequence,
              packetData,
            })
          )
          .transacting(trx);
      }

      events.forEach(async (event) => {
        if (event.type === Event.EVENT_TYPE.SEND_PACKET) {
          const foundIBCProgress = await initIBCProgress(
            event.attr.packet_src_channel,
            event.attr.packet_sequence,
            event.attr
          );
          await IbcProgress.query()
            .patch({
              tx_send_hash: event.hash,
            })
            .where({ id: foundIBCProgress.id });
        } else if (event.type === Event.EVENT_TYPE.RECV_PACKET) {
          const foundIBCProgress = await initIBCProgress(
            event.attr.packet_src_channel,
            event.attr.packet_sequence,
            event.attr
          );
          await IbcProgress.query()
            .patch({
              tx_receive_hash: event.hash,
            })
            .where({ id: foundIBCProgress.id });
        } else if (event.type === Event.EVENT_TYPE.ACKNOWLEDGE_PACKET) {
          const foundIBCProgress = await initIBCProgress(
            event.attr.packet_src_channel,
            event.attr.packet_sequence,
            event.attr
          );
          await IbcProgress.query()
            .patch({
              tx_ack_hash: event.hash,
            })
            .where({ id: foundIBCProgress.id });
        } else if (event.type === Event.EVENT_TYPE.TIMEOUT_PACKET) {
          const foundIBCProgress = await initIBCProgress(
            event.attr.packet_src_channel,
            event.attr.packet_sequence,
            event.attr
          );
          await IbcProgress.query()
            .patch({
              tx_timeout_hash: event.hash,
            })
            .where({ id: foundIBCProgress.id });
        }
      });

      updateBlockCheckpoint.height = endHeight;
      await BlockCheckpoint.query()
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge()
        .returning('id')
        .transacting(trx);
    });
  }

  _start(): Promise<void> {
    this.createJob(
      BULL_JOB_NAME.HANDLE_IBC_EVENT,
      BULL_JOB_NAME.HANDLE_IBC_EVENT,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.handleIbcEvent.millisecondCrawl,
        },
      }
    );
    this.createJob(
      BULL_JOB_NAME.HANDLE_IBC_TRANSACTION,
      BULL_JOB_NAME.HANDLE_IBC_TRANSACTION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.handleIbcTx.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
