import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import { Knex } from 'knex';
import _ from 'lodash';
import knex from '../../common/utils/db_connection';
import config from '../../../config.json' assert { type: 'json' };
import BullableService, { QueueHandler } from '../../base/bullable.service';
import { BULL_JOB_NAME, SERVICE } from '../../common';
import {
  BlockCheckpoint,
  Event,
  EventAttribute,
  IbcChannel,
  IbcClient,
  IbcConnection,
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
      .whereIn('event.type', [
        Event.EVENT_TYPE.CREATE_CLIENT,
        Event.EVENT_TYPE.CONNECTION_OPEN_ACK,
        Event.EVENT_TYPE.CONNECTION_OPEN_CONFIRM,
        Event.EVENT_TYPE.CHANNEL_OPEN_ACK,
        Event.EVENT_TYPE.CHANNEL_OPEN_CONFIRM,
        Event.EVENT_TYPE.CHANNEL_CLOSE_INIT,
        Event.EVENT_TYPE.CHANNEL_CLOSE_CONFIRM,
        Event.EVENT_TYPE.CHANNEL_CLOSE,
      ])
      .andWhere('event.block_height', '>', startHeight)
      .andWhere('event.block_height', '<=', endHeight)
      .orderBy('event.block_height');
    await knex.transaction(async (trx) => {
      await this.handleNewIbcClient(
        events.filter((event) => event.type === Event.EVENT_TYPE.CREATE_CLIENT),
        trx
      );
      await this.handleNewIbcConnection(
        events.filter(
          (event) =>
            event.type === Event.EVENT_TYPE.CONNECTION_OPEN_CONFIRM ||
            event.type === Event.EVENT_TYPE.CONNECTION_OPEN_ACK
        ),
        trx
      );
      await this.handleNewIbcChannel(
        events.filter(
          (event) =>
            event.type === Event.EVENT_TYPE.CHANNEL_OPEN_ACK ||
            event.type === Event.EVENT_TYPE.CHANNEL_OPEN_CONFIRM
        ),
        trx
      );
      await this.handleCloseIbcChannel(
        events.filter(
          (event) =>
            event.type === Event.EVENT_TYPE.CHANNEL_CLOSE ||
            event.type === Event.EVENT_TYPE.CHANNEL_CLOSE_CONFIRM ||
            event.type === Event.EVENT_TYPE.CHANNEL_CLOSE_INIT
        ),
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
      this.logger.info(`New IBC Clients: ${newClients}`);
      await IbcClient.query().insert(newClients).transacting(trx);
    }
  }

  async handleNewIbcConnection(events: Event[], trx: Knex.Transaction) {
    if (events.length > 0) {
      const ibcClientsByClientId = _.keyBy(
        await IbcClient.query().whereIn(
          'client_id',
          events.map((event) =>
            getAttributeFrom(
              event.attributes,
              EventAttribute.ATTRIBUTE_KEY.CLIENT_ID
            )
          )
        ),
        'client_id'
      );
      const newConnections: IbcConnection[] = events.map((event) =>
        IbcConnection.fromJson({
          ibc_client_id:
            ibcClientsByClientId[
              getAttributeFrom(
                event.attributes,
                EventAttribute.ATTRIBUTE_KEY.CLIENT_ID
              )
            ].id,
          connection_id: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.CONNECTION_ID
          ),
          counterparty_client_id: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.COUNTERPARTY_CLIENT_ID
          ),
          counterparty_connection_id: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.COUNTERPARTY_CONNECTION_ID
          ),
        })
      );
      this.logger.info(`New IBC Connections: ${newConnections}`);
      await IbcConnection.query().insert(newConnections).transacting(trx);
    }
  }

  async handleNewIbcChannel(events: Event[], trx: Knex.Transaction) {
    if (events.length > 0) {
      const ibcConnectionsByConnetionId = _.keyBy(
        await IbcConnection.query().whereIn(
          'connection_id',
          events.map((event) =>
            getAttributeFrom(
              event.attributes,
              EventAttribute.ATTRIBUTE_KEY.CONNECTION_ID
            )
          )
        ),
        'connection_id'
      );
      const newChannels: IbcChannel[] = events.map((event) =>
        IbcChannel.fromJson({
          ibc_connection_id:
            ibcConnectionsByConnetionId[
              getAttributeFrom(
                event.attributes,
                EventAttribute.ATTRIBUTE_KEY.CONNECTION_ID
              )
            ].id,
          channel_id: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.CHANNEL_ID
          ),
          port_id: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.PORT_ID
          ),
          counterparty_port_id: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.COUNTERPARTY_PORT_ID
          ),
          counterparty_channel_id: getAttributeFrom(
            event.attributes,
            EventAttribute.ATTRIBUTE_KEY.COUNTERPARTY_CHANNEL_ID
          ),
          state: true,
        })
      );
      this.logger.info(`New IBC Channels: ${newChannels}`);
      await IbcChannel.query().insert(newChannels).transacting(trx);
    }
  }

  async handleCloseIbcChannel(events: Event[], trx: Knex.Transaction) {
    if (events.length > 0) {
      const queries = events.map((event) => {
        const channelId = getAttributeFrom(
          event.attributes,
          EventAttribute.ATTRIBUTE_KEY.CHANNEL_ID
        );
        if (!channelId) {
          throw new Error(
            `Event close channel not found channelId: ${event.id}`
          );
        }
        return IbcChannel.query()
          .update({
            state: false,
          })
          .where({
            channel_id: channelId,
          })
          .transacting(trx);
      });
      await Promise.all(queries);
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
