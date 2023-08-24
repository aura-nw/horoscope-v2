import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { Knex } from 'knex';
import { ServiceBroker } from 'moleculer';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import knex from '../../common/utils/db_connection';
import { BlockCheckpoint, IbcIcs20, IbcMessage } from '../../models';

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
    await knex.transaction(async (trx) => {
      await this.handleIcs20Send(startHeight, endHeight, trx);
    });
    this.logger.info(updateBlockCheckpoint);
  }

  async handleIcs20Send(
    startHeight: number,
    endHeight: number,
    trx: Knex.Transaction
  ) {
    const ics20Sends = await IbcMessage.query()
      .joinRelated('message.transaction')
      .where('src_port_id', PORT)
      .andWhere('ibc_message.type', IbcMessage.EVENT_TYPE.SEND_PACKET)
      .andWhere('message:transaction.height', '>', startHeight)
      .andWhere('message:transaction.height', '<=', endHeight)
      .orderBy('message.id');
    if (ics20Sends.length > 0) {
      const ibcIcs20s = ics20Sends.map((msg) =>
        IbcIcs20.fromJson({
          ibc_message_id: msg.id,
          ...msg.data,
        })
      );
      await IbcIcs20.query().insert(ibcIcs20s).transacting(trx);
    }
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
