import { fromHex, fromUtf8 } from '@cosmjs/encoding';
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Knex } from 'knex';
import { ServiceBroker } from 'moleculer';
import knex from '../../common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import { getAttributeFrom } from '../../common/utils/smart_contract';
import {
  BlockCheckpoint,
  Event,
  EventAttribute,
  IbcMessage,
} from '../../models';

@Service({
  name: SERVICE.V1.CrawlIBCAppService.key,
  version: 1,
})
export default class CrawlIbcAppService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_APP,
    jobName: BULL_JOB_NAME.CRAWL_IBC_APP,
  })
  public async crawlIbcApp(): Promise<void> {
    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_IBC_APP,
        [BULL_JOB_NAME.CRAWL_IBC_TAO],
        config.crawlIbcTao.key
      );
    this.logger.info(
      `Handle IBC/APP, startHeight: ${startHeight}, endHeight: ${endHeight}`
    );
    if (startHeight > endHeight) return;
    const events = await Event.query()
      .withGraphFetched('attributes')
      .joinRelated('message')
      .select('event.id', 'event.type', 'message.id as message_id')
      .whereIn('event.type', [
        IbcMessage.EVENT_TYPE.ACKNOWLEDGE_PACKET,
        IbcMessage.EVENT_TYPE.RECV_PACKET,
        IbcMessage.EVENT_TYPE.SEND_PACKET,
        IbcMessage.EVENT_TYPE.TIMEOUT_PACKET,
      ])
      .andWhere('event.block_height', '>', startHeight)
      .andWhere('event.block_height', '<=', endHeight)
      .orderBy('event.id');
    await knex.transaction(async (trx) => {
      await this.handleIbcMessage(events, trx);
      updateBlockCheckpoint.height = endHeight;
      await BlockCheckpoint.query()
        .transacting(trx)
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge();
    });
  }

  async handleIbcMessage(events: Event[], trx: Knex.Transaction) {
    const ibcMessage = events.map((event) => {
      const srcChannel = getAttributeFrom(
        event.attributes,
        EventAttribute.ATTRIBUTE_KEY.SRC_CHANNEL
      );
      const srcPort = getAttributeFrom(
        event.attributes,
        EventAttribute.ATTRIBUTE_KEY.SRC_PORT
      );
      const dstChannel = getAttributeFrom(
        event.attributes,
        EventAttribute.ATTRIBUTE_KEY.DST_CHANNEL
      );
      const dstPort = getAttributeFrom(
        event.attributes,
        EventAttribute.ATTRIBUTE_KEY.DST_PORT
      );
      const sequence = getAttributeFrom(
        event.attributes,
        EventAttribute.ATTRIBUTE_KEY.SEQUENCE
      );
      const dataHex = getAttributeFrom(
        event.attributes,
        EventAttribute.ATTRIBUTE_KEY.DATA_HEX
      );
      return IbcMessage.fromJson({
        transaction_message_id: event.message_id,
        src_channel_id: srcChannel,
        src_port_id: srcPort,
        dst_channel_id: dstChannel,
        dst_port_id: dstPort,
        type: event.type,
        sequence,
        sequence_key: `${srcChannel}.${srcPort}.${dstChannel}.${dstPort}.${sequence}`,
        data: fromUtf8(fromHex(dataHex)),
      });
    });
    if (ibcMessage.length > 0) {
      await IbcMessage.query().insert(ibcMessage).transacting(trx);
    }
  }

  async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.CRAWL_IBC_APP,
      BULL_JOB_NAME.CRAWL_IBC_APP,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlIbcApp.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
