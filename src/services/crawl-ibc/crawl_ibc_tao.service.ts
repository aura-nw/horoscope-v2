import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { Knex } from 'knex';
import knex from '../../common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import {
  BlockCheckpoint,
  Event,
  EventAttribute,
  IbcClient,
} from '../../models';
import { getAttributeFrom } from '../../common/utils/smart_contract';

@Service({
  name: SERVICE.V1.CrawlIBCTaoService.key,
  version: 1,
})
export default class CrawlIbcTaoService extends BullableService {
  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_TAO,
    jobName: BULL_JOB_NAME.CRAWL_IBC_TAO,
  })
  public async crawlIbcTao(): Promise<void> {
    const [startHeight, endHeight, updateBlockCheckpoint] =
      await BlockCheckpoint.getCheckpoint(
        BULL_JOB_NAME.CRAWL_IBC_TAO,
        [BULL_JOB_NAME.HANDLE_TRANSACTION],
        config.crawlIbcTao.key
      );
    this.logger.info(
      `Handle IBC/TAO, startHeight: ${startHeight}, endHeight: ${endHeight}`
    );
    if (startHeight > endHeight) return;
    const events = await Event.query()
      .withGraphFetched('attributes')
      .joinRelated('[transaction,message]')
      .select('transaction.hash', 'event.id', 'event.type', 'message.content')
      .whereIn('event.type', [Event.EVENT_TYPE.CREATE_CLIENT])
      .andWhere('event.block_height', '>', startHeight)
      .andWhere('event.block_height', '<=', endHeight)
      .orderBy('event.block_height');
    await knex.transaction(async (trx) => {
      await this.handleNewIbcClient(
        events.filter((event) => event.type === Event.EVENT_TYPE.CREATE_CLIENT),
        trx
      );
      updateBlockCheckpoint.height = endHeight;
      await BlockCheckpoint.query()
        .transacting(trx)
        .insert(updateBlockCheckpoint)
        .onConflict('job_name')
        .merge();
    });
  }

  async handleNewIbcClient(events: Event[], trx: Knex.Transaction) {
    if (events.length > 0) {
      const newClients: IbcClient[] = events.map((event) =>
        IbcClient.fromJson({
          client_id: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.CLIENT_ID
          ),
          counterparty_chain_id: event.content.client_state.chain_id,
          client_state: event.content.client_state,
          consensus_state: event.content.consensus_state,
          client_type: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.CLIENT_TYPE
          ),
        })
      );
      this.logger.info(`New IBC Client: ${newClients}`);
      await IbcClient.query().insert(newClients).transacting(trx);
    }
  }

  async _start(): Promise<void> {
    await this.createJob(
      BULL_JOB_NAME.CRAWL_IBC_TAO,
      BULL_JOB_NAME.CRAWL_IBC_TAO,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlIbcTao.millisecondRepeatJob,
        },
      }
    );
    return super._start();
  }
}
