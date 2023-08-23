import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import { BlockCheckpoint, IbcMessage } from '../../models';

const PORT = config.crawlIbcIcs20.port;
@Service({
  name: SERVICE.V1.CrawlIBCIcs20Service.key,
  version: 1,
})
export default class CrawlIBCIcs20Service extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_ICS20,
    jobName: BULL_JOB_NAME.CRAWL_IBC_ICS20,
  })
  public async crawlIbcIcs20(): Promise<void> {
    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_IBC_ICS20,
        [BULL_JOB_NAME.CRAWL_IBC_APP],
        config.crawlIbcIcs20.key
      );
    this.logger.info(
      `Handle IBC/ICS20, startHeight: ${startHeight}, endHeight: ${endHeight}`
    );
    if (startHeight > endHeight) return;
    const ics20Transfers = await IbcMessage.query()
      .withGraphFetched('message.events(selectIcs20Event).attributes')
      .joinRelated('message.transaction')
      .modifiers({
        selectIcs20Event(builder) {
          builder.where('type', 'fungible_token_packet');
        },
      })
      .where('src_port_id', PORT)
      .andWhere('ibc_message.type', IbcMessage.EVENT_TYPE.ACKNOWLEDGE_PACKET)
      .andWhere('message:transaction.height', '>', startHeight)
      .andWhere('message:transaction.height', '<=', endHeight)
      .orderBy('message.id');
    const ics20Receives = await IbcMessage.query()
      .withGraphFetched('message.events(selectIcs20Event).attributes')
      .joinRelated('message.transaction')
      .modifiers({
        selectIcs20Event(builder) {
          builder.where('type', 'fungible_token_packet');
        },
      })
      .where('src_port_id', PORT)
      .andWhere('ibc_message.type', IbcMessage.EVENT_TYPE.RECV_PACKET)
      .andWhere('message:transaction.height', '>', startHeight)
      .andWhere('message:transaction.height', '<=', endHeight)
      .orderBy('message.id');
    this.logger.info(ics20Transfers, ics20Receives, updateBlockCheckpoint);
  }

  async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.CRAWL_IBC_ICS20,
      BULL_JOB_NAME.CRAWL_IBC_ICS20,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlIbcIcs20.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
