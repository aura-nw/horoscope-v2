/* eslint-disable no-await-in-loop */
import { Service } from '@ourparentcenter/moleculer-decorators-extended';
import { ServiceBroker } from 'moleculer';
import Utils from '../../common/utils/utils';
import BullableService, { QueueHandler } from '../../base/bullable.service';
import config from '../../../config.json' assert { type: 'json' };
import {
  BULL_JOB_NAME,
  IAuraJSClientFactory,
  SERVICE,
  getLcdClient,
} from '../../common';
import { IbcChannel, IbcClient, IbcConnection } from '../../models';

@Service({
  name: SERVICE.V1.CrawlIBCService.key,
  version: 1,
})
export default class CrawlIBCService extends BullableService {
  private _lcdClient!: IAuraJSClientFactory;

  public constructor(public broker: ServiceBroker) {
    super(broker);
  }

  // query all connection
  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_CONNECTION,
    jobName: BULL_JOB_NAME.CRAWL_IBC_CONNECTION,
  })
  public async crawlIbcConnection() {
    this.logger.info('Crawling IBC connection');

    const connections: any[] = await Utils.getListResultWithNextKey(
      config.crawlIbcConnection.queryPageLimit,
      this._lcdClient.ibc.ibc.core.connection.v1.connections,
      {},
      'connections'
    );

    this.logger.debug('list connection: ');
    this.logger.debug(connections);

    // crawl ibc client by client_id
    await Promise.all(
      connections.map((connection: any) =>
        this.crawlIbcClient({ clientId: connection.client_id })
      )
    );
    const connectionPushDB: any[] = connections.map((connection: any) =>
      IbcConnection.fromJson({
        connection_id: connection.id,
        client_id: connection.client_id,
        versions: JSON.stringify(connection.versions),
        state: connection.state,
        counterparty: connection.counterparty,
        delay_period: connection.delay_period,
        height: connection.height,
      })
    );

    if (connectionPushDB.length > 0) {
      // insert connection ibc
      await IbcConnection.query()
        .insert(connectionPushDB)
        .onConflict('connection_id')
        .merge()
        .catch((err) => {
          this.logger.error(err);
        });

      // crawl ibc channel by connection_id
      connections.forEach((connection) => {
        if (connection.state === IbcConnection.STATE.STATE_OPEN)
          this.createJob(
            BULL_JOB_NAME.CRAWL_IBC_CHANNEL,
            BULL_JOB_NAME.CRAWL_IBC_CHANNEL,
            {
              connectionId: connection.id,
            },
            {
              jobId: connection.id,
              removeOnComplete: true,
              removeOnFail: {
                count: 3,
              },
            }
          );
      });
    }
  }

  @QueueHandler({
    queueName: BULL_JOB_NAME.CRAWL_IBC_CHANNEL,
    jobName: BULL_JOB_NAME.CRAWL_IBC_CHANNEL,
  })
  public async crawlIbcChannel(_payload: { connectionId: string }) {
    this.logger.info(
      'Crawl IBC channel by connection_id',
      _payload.connectionId
    );

    const channels: any[] = await Utils.getListResultWithNextKey(
      config.crawlIbcChannel.queryPageLimit,
      this._lcdClient.ibc.ibc.core.channel.v1.connectionChannels,
      {
        connection: _payload.connectionId,
      },
      'channels'
    );

    this.logger.debug(
      'list channel associate with connection : ',
      _payload.connectionId
    );
    this.logger.debug(channels);
    const ibcChannels = channels.map((channel: any) =>
      IbcChannel.fromJson({
        connection_id: _payload.connectionId,
        channel_id: channel.channel_id,
        state: channel.state,
        ordering: channel.ordering,
        counterparty: channel.counterparty,
        connection_hops: channel.connection_hops,
        version: channel.version,
        port_id: channel.port_id,
        height: channel.height,
      })
    );
    if (ibcChannels.length > 0) {
      await IbcChannel.query()
        .insert(ibcChannels)
        .onConflict('channel_id')
        .merge()
        .catch((err) => {
          this.logger.error(err);
        });
    }
  }

  public async crawlIbcClient(_payload: { clientId: string }) {
    this.logger.info('Crawling IBC client', _payload.clientId);
    const [clientState, clientStatus] = await Promise.all([
      this._lcdClient.ibc.ibc.core.client.v1.clientState({
        clientId: _payload.clientId,
      }),
      this._lcdClient.ibc.ibc.core.client.v1.clientStatus({
        clientId: _payload.clientId,
      }),
    ]);

    this.logger.debug('client state: ');
    this.logger.debug(clientState);
    this.logger.debug('client status: ');
    this.logger.debug(clientStatus);

    const ibcClient = IbcClient.fromJson({
      client_id: _payload.clientId,
      counterparty_chain_id: clientState.client_state.chain_id,
      client_state: clientState,
      status: clientStatus.status,
    });

    if (ibcClient) {
      await IbcClient.query()
        .insert(ibcClient)
        .onConflict('client_id')
        .merge()
        .catch((err) => {
          this.logger.error(err);
        });
    }
  }

  public async _start() {
    this._lcdClient = await getLcdClient();
    this.createJob(
      BULL_JOB_NAME.CRAWL_IBC_CONNECTION,
      BULL_JOB_NAME.CRAWL_IBC_CONNECTION,
      {},
      {
        removeOnComplete: true,
        removeOnFail: {
          count: 3,
        },
        repeat: {
          every: config.crawlIbcConnection.millisecondCrawl,
        },
      }
    );
    return super._start();
  }
}
